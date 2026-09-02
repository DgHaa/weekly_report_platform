import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import * as Y from 'yjs';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import Icon from './icons';
import { useDialog } from './Dialog';

const COLORS = ['#185FA5', '#3B6D11', '#854F0B', '#72243E', '#534AB7', '#0C447C'];

// 图片过大时前端压缩：最长边不超过 maxDim，转 JPEG 0.85
async function compressImage(file: File, maxDim = 1600): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = url; });
    let { width, height } = img;
    if (width <= maxDim && height <= maxDim) return null;
    const scale = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * scale); height = Math.round(height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), 'image/jpeg', 0.85));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// 带进度的附件上传（XHR）
function uploadWithProgress(weeklyReportId: number, file: Blob, name: string, onProgress: (p: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('file', file, name);
    fd.append('weekly_report_id', String(weeklyReportId));
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/attachments');
    const t = localStorage.getItem('wr_token');
    if (t) xhr.setRequestHeader('Authorization', `Bearer ${t}`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText).url); } catch { reject(new Error('上传失败')); }
      } else reject(new Error('上传失败'));
    };
    xhr.onerror = () => reject(new Error('上传失败'));
    xhr.send(fd);
  });
}

export default function RichTextEditor({
  ydoc, provider, field, workItemId, initialHTML, userName, onSave, weeklyReportId
}: {
  ydoc: Y.Doc; provider: any; field: string; workItemId: number; initialHTML: string; userName: string; onSave: (html: string) => void; weeklyReportId: number;
}) {
  const dialog = useDialog();
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);
  const seeded = useRef(false);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener', target: '_blank' } }),
      Collaboration.configure({ document: ydoc, field }),
      CollaborationCursor.configure({ provider, user: { name: userName || '匿名', color: COLORS[(workItemId || 0) % COLORS.length] } })
    ],
    onUpdate: () => setDirty(true)
  });

  // 兜底保存：组件卸载（切预览/返回）或页面隐藏时，把最近 10s 内的编辑落库，避免丢失
  const flush = () => {
    if (editor && dirty && !editor.isDestroyed) {
      onSaveRef.current(editor.getHTML());
      setDirty(false);
    }
  };

  useEffect(() => {
    if (!editor) return;
    const seed = () => {
      if (seeded.current) return;
      const frag = ydoc.getXmlFragment(field);
      if (frag.length === 0 && initialHTML) editor.commands.setContent(initialHTML);
      seeded.current = true;
    };
    provider.on('sync', (synced: boolean) => { if (synced) seed(); });
    seed();
    const t = setInterval(flush, 10000);
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onHide);
    const onPageHide = () => flush();
    window.addEventListener('pagehide', onPageHide);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      flush();
    };
  }, [editor, provider, ydoc, field, initialHTML]);

  const saveNow = () => {
    if (editor && dirty && !editor.isDestroyed) {
      onSaveRef.current(editor.getHTML());
      setDirty(false);
    }
  };

  const setLink = async () => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href || '';
    const url = await dialog.prompt({ title: '插入 / 编辑链接', placeholder: 'https://...', initial: prev, allowEmpty: true });
    if (url === null) return;
    if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const onUpload = async (e: any) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editor) return;
    let toSend: Blob = file;
    let name = file.name;
    if (file.type.startsWith('image/') && file.size > 1024 * 1024) {
      const compressed = await compressImage(file, 1600);
      if (compressed) { toSend = compressed; name = file.name.replace(/\.[^.]+$/, '.jpg'); }
    }
    setUploading(0);
    try {
      const url = await uploadWithProgress(weeklyReportId, toSend, name, (p) => setUploading(p));
      editor.chain().focus().setImage({ src: url }).run();
      setDirty(true);
      saveNow();
    } catch {
      dialog.confirm({ title: '上传失败', message: '图片上传出错，请重试或换一张图片。', confirmText: '知道了' });
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="rte">
      <div className="rte-bar">
        <button className={editor?.isActive('heading', { level: 2 }) ? 'active' : ''} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} title="标题 2">H2</button>
        <button className={editor?.isActive('heading', { level: 3 }) ? 'active' : ''} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} title="标题 3">H3</button>
        <span className="rte-sep" />
        <button className={editor?.isActive('bold') ? 'active' : ''} onClick={() => editor?.chain().focus().toggleBold().run()} title="加粗"><b>B</b></button>
        <button className={editor?.isActive('italic') ? 'active' : ''} onClick={() => editor?.chain().focus().toggleItalic().run()} title="斜体"><i>I</i></button>
        <button onClick={() => editor?.chain().focus().toggleBulletList().run()} title="项目符号列表">• 列表</button>
        <button className={editor?.isActive('link') ? 'active' : ''} onClick={setLink} title="链接">🔗</button>
        <span className="rte-sep" />
        <button onClick={() => editor?.chain().focus().undo().run()} disabled={!editor || !editor.can().undo()} title="撤销">↶</button>
        <button onClick={() => editor?.chain().focus().redo().run()} disabled={!editor || !editor.can().redo()} title="重做">↷</button>
        <span className="rte-sep" />
        <label className="rte-up"><Icon name="doc" size={14} /> 插入图片<input type="file" accept="image/*" onChange={onUpload} hidden /></label>
        <button onClick={saveNow}><Icon name="check" size={14} /> 保存</button>
        {uploading !== null
          ? <span className="dot uploading">上传中 {uploading}%</span>
          : <span className={dirty ? 'dot dirty' : 'dot'} role="status" aria-live="polite">{dirty ? '未保存' : '已同步'}</span>}
      </div>
      <EditorContent editor={editor} className="rte-content" />
    </div>
  );
}
