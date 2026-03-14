'use client';

import { useState, useEffect } from 'react';
import { ticketsAPI } from '@/lib/api';

interface Agent {
  id: number;
  username: string;
  email: string;
  role: string;
}

interface Ticket {
  id: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assigned_to_id?: number | null;
  assigned_to?: { id: number; username: string } | null;
}

interface TicketModalProps {
  ticket: Ticket | null;
  agents: Agent[];
  onClose: () => void;
  onSaved: () => void;
}

export default function TicketModal({ ticket, agents, onClose, onSaved }: TicketModalProps) {
  const isEditing = !!ticket;
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    status: 'open',
    assigned_to_id: '' as string | number,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ticket) {
      setFormData({
        title: ticket.title,
        description: ticket.description || '',
        priority: ticket.priority,
        status: ticket.status,
        assigned_to_id: ticket.assigned_to?.id || '',
      });
    }
  }, [ticket]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload: any = {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        assigned_to_id: formData.assigned_to_id ? Number(formData.assigned_to_id) : null,
      };

      if (isEditing) {
        payload.status = formData.status;
        await ticketsAPI.update(ticket!.id, payload);
      } else {
        await ticketsAPI.create(payload);
      }

      onSaved();
    } catch (err: any) {
      const errors = err.response?.data;
      if (errors && typeof errors === 'object') {
        const messages = Object.entries(errors)
          .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
          .join('. ');
        setError(messages);
      } else {
        setError('Failed to save ticket');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <h2>{isEditing ? 'Edit Ticket' : 'Create New Ticket'}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-banner">⚠ {error}</div>}

            <div className="form-group">
              <label className="form-label" htmlFor="modal-title">Title</label>
              <input
                id="modal-title"
                type="text"
                name="title"
                className="form-input"
                placeholder="Brief summary of the issue"
                value={formData.title}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="modal-description">Description</label>
              <textarea
                id="modal-description"
                name="description"
                className="form-textarea"
                placeholder="Describe the issue in detail..."
                value={formData.description}
                onChange={handleChange}
                required
                rows={4}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="modal-priority">Priority</label>
                <select
                  id="modal-priority"
                  name="priority"
                  className="form-select"
                  value={formData.priority}
                  onChange={handleChange}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              {isEditing && (
                <div className="form-group">
                  <label className="form-label" htmlFor="modal-status">Status</label>
                  <select
                    id="modal-status"
                    name="status"
                    className="form-select"
                    value={formData.status}
                    onChange={handleChange}
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="modal-assignee">Assign To</label>
                <select
                  id="modal-assignee"
                  name="assigned_to_id"
                  className="form-select"
                  value={formData.assigned_to_id}
                  onChange={handleChange}
                >
                  <option value="">Unassigned</option>
                  {agents.map(agent => (
                    <option key={agent.id} value={agent.id}>{agent.username}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : isEditing ? 'Update Ticket' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
