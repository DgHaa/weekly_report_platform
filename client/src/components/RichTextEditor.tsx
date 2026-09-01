import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import * as Y from 'yjs';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import Icon from './icons';

const COLORS = ['#185FA5', '#3B6D11', '#854F0B', '#72243E', '#534AB7', '#0C447C'];

export default function RichTextEditor({
  ydoc, provider, field, workItemId, initialHTML, userName, onSave, weeklyReportId
}: {
  ydoc: Y.Doc; provider: any; field: string; workItemId: number; initialHTML: string; userName: string; onSave: (html: string) => void; weeklyReportId: number;
}) {
  const [dirty, setDirty] = useState(false);
  const seeded = useRef(false);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: true }),
      Collaboration.configure({ document: ydoc, field }),
      CollaborationCursor.configure({ provider, user: { name: userName || '匿名', color: COLORS[(workItemId || 0) % COLORS.length] } })
    ],
    onUpdate: () => setDirty(true)
  });

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
    const t = setInterval(() => {
      if (dirty && editor && !editor.isDestroyed) {
        onSaveRef.current(editor.getHTML());
        setDirty(false);
      }
    }, 30000);
    return () => clearInterval(t);
  }, [editor, provider, ydoc, field, initialHTML]);

  const saveNow = () => {
    if (editor && dirty && !editor.isDestroyed) {
      onSaveRef.current(editor.getHTML());
      setDirty(false);
    }
  };

  const onUpload = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const res = await api.uploadAttachment(weeklyReportId, file);
    editor.chain().focus().setImage({ src: res.url }).run();
    setDirty(true);
    saveNow();
  };

  return (
    <div className="rte">
      <div className="rte-bar">
        <button onClick={() => editor?.chain().focus().toggleBold().run()} title="加粗"><b>B</b></button>
        <button onClick={() => editor?.chain().focus().toggleItalic().run()} title="斜体"><i>I</i></button>
        <button onClick={() => editor?.chain().focus().toggleBulletList().run()} title="列表">• 列表</button>
        <label className="rte-up"><Icon name="doc" size={14} /> 插入图片<input type="file" accept="image/*" onChange={onUpload} hidden /></label>
        <button onClick={saveNow}><Icon name="check" size={14} /> 保存</button>
        <span className={dirty ? 'dot dirty' : 'dot'} role="status" aria-live="polite">{dirty ? '未保存' : '已同步'}</span>
      </div>
      <EditorContent editor={editor} className="rte-content" />
    </div>
  );
}
