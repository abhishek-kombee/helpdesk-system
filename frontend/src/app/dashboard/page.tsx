'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { ticketsAPI, usersAPI, healthAPI } from '@/lib/api';
import Navbar from '@/components/Navbar';
import SystemHealth from '@/components/SystemHealth';
import TicketModal from '@/components/TicketModal';

interface Ticket {
  id: number;
  title: string;
  status: string;
  priority: string;
  created_by: { id: number; username: string };
  assigned_to: { id: number; username: string } | null;
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

export default function DashboardPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState({ status: '', priority: '', assigned_to: '' });
  const [showModal, setShowModal] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { page };
      if (filters.status) params.status = filters.status;
      if (filters.priority) params.priority = filters.priority;
      if (filters.assigned_to) params.assigned_to = filters.assigned_to;

      const response = await ticketsAPI.list(params);
      setTickets(response.data.results);
      setTotalCount(response.data.count);
      setError('');
    } catch (err: any) {
      setError('Failed to fetch tickets');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  const fetchAgents = useCallback(async () => {
    try {
      const response = await usersAPI.agents();
      setAgents(response.data);
    } catch (err) {
      console.error('Failed to fetch agents', err);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchTickets();
      fetchAgents();
    }
  }, [isAuthenticated, fetchTickets, fetchAgents]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
    setPage(1);
  };

  const handleTicketSaved = () => {
    setShowModal(false);
    setEditingTicket(null);
    fetchTickets();
  };

  const handleEdit = (ticket: Ticket, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTicket(ticket);
    setShowModal(true);
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this ticket?')) {
      try {
        await ticketsAPI.delete(id);
        fetchTickets();
      } catch (err) {
        setError('Failed to delete ticket');
      }
    }
  };

  const totalPages = Math.ceil(totalCount / 10);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  if (authLoading) {
    return (
      <div className="loading-container" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <div className="dashboard">
        {/* System Health Widget */}
        <SystemHealth />

        {/* Header */}
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Support Tickets</h1>
            <p className="dashboard-subtitle">{totalCount} tickets total</p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => { setEditingTicket(null); setShowModal(true); }}
          >
            + New Ticket
          </button>
        </div>

        {/* Filters */}
        <div className="filters-bar">
          <select
            className="form-select"
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="closed">Closed</option>
          </select>

          <select
            className="form-select"
            value={filters.priority}
            onChange={(e) => handleFilterChange('priority', e.target.value)}
          >
            <option value="">All Priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>

          <select
            className="form-select"
            value={filters.assigned_to}
            onChange={(e) => handleFilterChange('assigned_to', e.target.value)}
          >
            <option value="">All Agents</option>
            {agents.map(agent => (
              <option key={agent.id} value={agent.id}>{agent.username}</option>
            ))}
          </select>
        </div>

        {/* Error */}
        {error && <div className="error-banner">⚠ {error}</div>}

        {/* Table */}
        {loading ? (
          <div className="loading-container">
            <div className="spinner" />
            <p className="loading-text">Loading tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3>No tickets found</h3>
            <p>Create your first ticket to get started</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Created By</th>
                  <th>Assigned To</th>
                  <th>Comments</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(ticket => (
                  <tr key={ticket.id} onClick={() => router.push(`/dashboard/tickets/${ticket.id}`)}>
                    <td>#{ticket.id}</td>
                    <td className="ticket-title-cell">{ticket.title}</td>
                    <td>
                      <span className={`badge badge-${ticket.status}`}>
                        <span className="badge-dot" />
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${ticket.priority}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td>{ticket.created_by.username}</td>
                    <td>{ticket.assigned_to?.username || '—'}</td>
                    <td>{ticket.comments_count}</td>
                    <td>{formatDate(ticket.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={(e) => handleEdit(ticket, e)}>
                          Edit
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={(e) => handleDelete(ticket.id, e)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="pagination">
              <span className="pagination-info">
                Page {page} of {totalPages} ({totalCount} tickets)
              </span>
              <div className="pagination-buttons">
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  ← Previous
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <TicketModal
          ticket={editingTicket}
          agents={agents}
          onClose={() => { setShowModal(false); setEditingTicket(null); }}
          onSaved={handleTicketSaved}
        />
      )}
    </>
  );
}
