import { redirect } from 'next/navigation';

export default function AdminPage() {
  // Redirect to the users management page
  redirect('/admin/users');
}