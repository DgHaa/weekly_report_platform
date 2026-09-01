import { useAuth } from './auth';
import Login from './components/Login';
import WeeklyReportList from './components/WeeklyReportList';

export default function App() {
  const { user } = useAuth();
  if (!user) return <Login />;
  return <WeeklyReportList />;
}
