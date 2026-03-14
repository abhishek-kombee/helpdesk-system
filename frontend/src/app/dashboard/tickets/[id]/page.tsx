'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { ticketsAPI, commentsAPI, usersAPI } from '@/lib/api';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

interface Comment {
  id: number;
  user: User;
  message: string;
  created_at: string;
}

interface Ticket {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  created_by: User;
  assigned_to: User | null;
  assigned_to_id: number | null;
  comments: Comment[];
  comments_count: number;
  created_at: string;
  updated_at: string;
}

interface Agent {
  id: number;
  username: string;
  email: string;
  role: string;
}

export default function TicketDetailPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const ticketId = Number(params.id);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);
  const [editingPriority, setEditingPriority] = useState(false);
  const [editingAssignee, setEditingAssignee] = useState(false);

  const fetchTicket = useCallback(async () => {
    try {
      setLoading(true);
      const response = await ticketsAPI.get(ticketId);
      setTicket(response.data);
      setError('');
    } catch (err: any) {
      setError('Failed to fetch ticket');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  const fetchAgents = useCallback(async () => {
    try {
      const response = await usersAPI.agents();
      setAgents(response.data);
    } catch (err) {
      console.error('Failed to fetch agents');
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchTicket();
      fetchAgents();
    }
  }, [isAuthenticated, fetchTicket, fetchAgents]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setCommentLoading(true);
    try {
      await commentsAPI.create(ticketId, { message: newComment });
      setNewComment('');
      fetchTicket();
    } catch (err) {
      setError('Failed to add comment');
    } finally {
      setCommentLoading(false);
    }
  };

  const handleUpdateField = async (field: string, value: string | number | null) => {
    try {
      await ticketsAPI.update(ticketId, { [field]: value });
      fetchTicket();
      setEditingStatus(false);
      setEditingPriority(false);
      setEditingAssignee(false);
    } catch (err) {
      setError('Failed to update ticket');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (authLoading || loading) {
    return (
      <>
        <Navbar />
        <div className="loading-container" style={{ minHeight: '80vh' }}>
          <div className="spinner" />
          <p className="loading-text">Loading ticket...</p>
        </div>
      </>
    );
  }

  if (!ticket) {
    return (
      <>
        <Navbar />
        <div className="ticket-detail">
          <div className="error-banner">Ticket not found</div>
          <Link href="/dashboard" className="btn btn-secondary">← Back to Dashboard</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="ticket-detail">
        <Link href="/dashboard" className="back-link">← Back to Tickets</Link>

        {error && <div className="error-banner">⚠ {error}</div>}

        {/* Header */}
        <div className="ticket-detail-header">
          <h1>#{ticket.id} — {ticket.title}</h1>
          <div className="ticket-meta">
            {/* Status */}
            {editingStatus ? (
              <select
                className="form-select"
                value={ticket.status}
                onChange={(e) => handleUpdateField('status', e.target.value)}
                onBlur={() => setEditingStatus(false)}
                autoFocus
                style={{ width: 'auto', minWidth: '130px' }}
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="closed">Closed</option>
              </select>
            ) : (
              <span
                className={`badge badge-${ticket.status}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setEditingStatus(true)}
                title="Click to change status"
              >
                <span className="badge-dot" />
                {ticket.status.replace('_', ' ')}
              </span>
            )}

            {/* Priority */}
            {editingPriority ? (
              <select
                className="form-select"
                value={ticket.priority}
                onChange={(e) => handleUpdateField('priority', e.target.value)}
                onBlur={() => setEditingPriority(false)}
                autoFocus
                style={{ width: 'auto', minWidth: '110px' }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            ) : (
              <span
                className={`badge badge-${ticket.priority}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setEditingPriority(true)}
                title="Click to change priority"
              >
                {ticket.priority}
              </span>
            )}

            {/* Assigned To */}
            {editingAssignee ? (
              <select
                className="form-select"
                value={ticket.assigned_to?.id || ''}
                onChange={(e) => handleUpdateField('assigned_to_id', e.target.value ? Number(e.target.value) : null)}
                onBlur={() => setEditingAssignee(false)}
                autoFocus
                style={{ width: 'auto', minWidth: '140px' }}
              >
                <option value="">Unassigned</option>
                {agents.map(agent => (
                  <option key={agent.id} value={agent.id}>{agent.username}</option>
                ))}
              </select>
            ) : (
              <span
                className="ticket-meta-item"
                style={{ cursor: 'pointer' }}
                onClick={() => setEditingAssignee(true)}
                title="Click to change assignee"
              >
                👤 {ticket.assigned_to?.username || 'Unassigned'}
              </span>
            )}

            <span className="ticket-meta-item">🕐 {formatDate(ticket.created_at)}</span>
            <span className="ticket-meta-item">By {ticket.created_by.username}</span>
          </div>
        </div>

        {/* Description */}
        <div className="ticket-description">
          {ticket.description}
        </div>

        {/* Comments */}
        <div className="comments-section">
          <h2>
            Comments
            <span className="comments-count">{ticket.comments.length}</span>
          </h2>

          {ticket.comments.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <p>No comments yet. Be the first to comment!</p>
            </div>
          ) : (
            ticket.comments.map((comment) => (
              <div key={comment.id} className="comment-card">
                <div className="comment-header">
                  <span className="comment-author">{comment.user.username}</span>
                  <span className="comment-time">{timeAgo(comment.created_at)}</span>
                </div>
                <div className="comment-body">{comment.message}</div>
              </div>
            ))
          )}

          {/* Add Comment Form */}
          <form className="comment-form" onSubmit={handleAddComment}>
            <textarea
              className="form-textarea"
              placeholder="Write a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
            />
            <div className="comment-form-actions">
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={commentLoading || !newComment.trim()}
              >
                {commentLoading ? 'Posting...' : 'Post Comment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
