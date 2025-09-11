'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserPlus, Mail, Shield, Users, Eye, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function InviteUserDialog({ open, onOpenChange, onSuccess }: InviteUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'viewer',
    department: '',
    job_title: '',
    message: ''
  });
  const [bulkEmails, setBulkEmails] = useState('');
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'single') {
        // Send single invitation
        const response = await fetch('/api/admin/users/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });

        if (!response.ok) throw new Error('Failed to send invitation');

        toast.success(`Invitation sent to ${formData.email}`);
        resetForm();
        onSuccess();
        onOpenChange(false);
      } else {
        // Send bulk invitations
        const emails = bulkEmails
          .split(/[\n,]/)
          .map(email => email.trim())
          .filter(email => email && email.includes('@'));

        if (emails.length === 0) {
          toast.error('Please enter valid email addresses');
          return;
        }

        const response = await fetch('/api/admin/users/invite/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            emails,
            role: formData.role,
            department: formData.department
          })
        });

        if (!response.ok) throw new Error('Failed to send invitations');

        toast.success(`${emails.length} invitations sent successfully`);
        resetForm();
        onSuccess();
        onOpenChange(false);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invitation');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      full_name: '',
      role: 'viewer',
      department: '',
      job_title: '',
      message: ''
    });
    setBulkEmails('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite New Users
          </DialogTitle>
          <DialogDescription>
            Send invitations to new users to join your organization
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode Toggle */}
          <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
            <Button
              type="button"
              variant={mode === 'single' ? 'default' : 'ghost'}
              size="sm"
              className="flex-1"
              onClick={() => setMode('single')}
            >
              Single User
            </Button>
            <Button
              type="button"
              variant={mode === 'bulk' ? 'default' : 'ghost'}
              size="sm"
              className="flex-1"
              onClick={() => setMode('bulk')}
            >
              Bulk Invite
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'single' ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address*</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="user@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input
                      id="full_name"
                      placeholder="John Doe"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Input
                      id="department"
                      placeholder="Engineering"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="job_title">Job Title</Label>
                    <Input
                      id="job_title"
                      placeholder="Software Engineer"
                      value={formData.job_title}
                      onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Personal Message (Optional)</Label>
                  <Textarea
                    id="message"
                    placeholder="Welcome to our team! We're excited to have you..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    rows={3}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="bulk_emails">Email Addresses*</Label>
                <Textarea
                  id="bulk_emails"
                  placeholder="Enter email addresses, one per line or comma-separated:
john@example.com
jane@example.com
bob@example.com"
                  value={bulkEmails}
                  onChange={(e) => setBulkEmails(e.target.value)}
                  rows={6}
                  required
                />
                <p className="text-xs text-gray-500">
                  Enter multiple email addresses, one per line or comma-separated
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="role">Default Role*</Label>
              <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Admin - Full system access
                    </div>
                  </SelectItem>
                  <SelectItem value="editor">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Editor - Can edit content
                    </div>
                  </SelectItem>
                  <SelectItem value="viewer">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Viewer - Read-only access
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send {mode === 'bulk' ? 'Invitations' : 'Invitation'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}