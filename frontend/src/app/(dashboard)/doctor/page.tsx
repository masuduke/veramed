'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import {
  Stethoscope, Clock, CheckCircle, XCircle,
  ChevronRight, AlertTriangle, BarChart2, ToggleLeft, ToggleRight,
} from 'lucide-react';

export default function DoctorDashboard() {
  const queryClient = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ['doctor-stats'],
    queryFn:  () => api.get('/doctor/stats').then((r) => r.data),
  });

  const { data: cases, isLoading } = useQuery({
    queryKey: ['pending-cases'],
    queryFn:  () => api.get('/doctor/pending-cases').then((r) => r.data),
  });

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn:  () => api.get('/auth/me').then((r) => r.data),
  });

  const availabilityMutation = useMutation({
    mutationFn: (available: boolean) => api.patch('/doctor/availability', { available }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  });

  const pendingCases = cases?.slice(0, 5) || [];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* Header row */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Doctor Dashboard</h2>
          <p className="text-sm text-gray-500">Review AI-generated suggestions and issue prescriptions</p>
        </div>
        <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-2.5">
          <span className="text-sm text-gray-600 font-medium">Accepting cases</span>
          <button
            onClick={() => availabilityMutation.mutate(!me?.doctor?.available)}
            className="transition-all"
          >
            {me?.doctor?.available
              ? <ToggleRight size={26} className="text-mint-500" />
              : <ToggleLeft  size={26} className="text-gray-300" />
            }
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Pending Review', value: stats?.pending  || 0, color: 'text-amber-600', bg: 'bg-amber-50',  border: 'border-amber-100' },
          { label: 'Approved Today', value: stats?.approved || 0, color: 'text-mint-700',  bg: 'bg-mint-50',   border: 'border-mint-100'  },
          { label: 'Rejected',       value: stats?.rejected || 0, color: 'text-red-600',   bg: 'bg-red-50',    border: 'border-red-100'   },
          { label: 'Total Cases',    value: stats?.total    || 0, color: 'text-navy-900',  bg: 'bg-white',     border: 'border-gray-100'  },
        ].map(({ label, value, color, bg, border }) => (
          <div key={label} className={`${bg} border ${border} rounded-xl p-4`}>
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={`text-2xl font-semibold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Pending Cases Queue */}
      <div className="bg-white border border-gray-100 rounded-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Stethoscope size={18} className="text-navy-700" />
            <h3 className="font-semibold text-gray-900">Pending Cases</h3>
            {stats?.pending > 0 && (
              <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {stats.pending}
              </span>
            )}
          </div>
          <Link href="/doctor/cases" className="text-xs text-mint-600 hover:underline flex items-center gap-1">
            View all <ChevronRight size={12} />
          </Link>
        </div>

        {isLoading && (
          <div className="p-8 text-center text-gray-400 text-sm">Loading cases...</div>
        )}

        {!isLoading && pendingCases.length === 0 && (
          <div className="p-10 text-center">
            <CheckCircle size={36} className="mx-auto mb-3 text-mint-400 opacity-60" />
            <p className="text-gray-500 text-sm font-medium">All caught up!</p>
            <p className="text-gray-400 text-xs mt-1">No pending cases right now.</p>
          </div>
        )}

        {pendingCases.map((c: any) => {
          const confidence = Math.round((c.aiAnalysis?.confidenceScore || 0) * 100);
          const hasWarnings = c.aiAnalysis?.warnings?.length > 0;
          const urgency = c.aiAnalysis?.rawResponse?.parsed?.urgencyLevel;

          return (
            <Link
              key={c.id}
              href={`/doctor/cases/${c.id}`}
              className="flex items-center gap-4 p-4 border-b border-gray-50 hover:bg-gray-50/80 transition-all group last:border-b-0"
            >
              {/* Patient avatar */}
              <div className="w-10 h-10 rounded-full bg-navy-100 flex items-center justify-center flex-shrink-0">
                <span className="text-navy-700 font-semibold text-sm">
                  {c.patient?.user?.name?.slice(0, 2).toUpperCase()}
                </span>
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-gray-900">{c.patient?.user?.name}</p>
                  {urgency === 'emergency' && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold animate-pulse">
                      URGENT
                    </span>
                  )}
                  {urgency === 'urgent' && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                      Urgent
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 truncate">
                  {c.aiAnalysis?.report?.description || 'No description provided'}
                </p>
              </div>

              {/* Confidence + Warnings */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {hasWarnings && (
                  <div title="Has warnings" className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
                    <AlertTriangle size={12} className="text-amber-600" />
                  </div>
                )}
                <div className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  confidence >= 70 ? 'bg-green-100 text-green-700'
                  : confidence >= 40 ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700'
                }`}>
                  {confidence}%
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock size={12} />
                  {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <ChevronRight size={15} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart2 size={16} className="text-blue-600" />
            <span className="text-sm font-semibold text-blue-800">Your Impact</span>
          </div>
          <p className="text-xs text-blue-600 leading-relaxed">
            You've approved <strong>{stats?.approved || 0}</strong> prescriptions, helping patients
            access medication faster through doctor-verified AI assistance.
          </p>
        </div>
        <div className="bg-navy-50 border border-navy-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Stethoscope size={16} className="text-navy-600" />
            <span className="text-sm font-semibold text-navy-800">Reminder</span>
          </div>
          <p className="text-xs text-navy-600 leading-relaxed">
            All AI suggestions are <strong>advisory only</strong>. You retain full clinical authority
            to approve, modify, or reject any suggestion.
          </p>
        </div>
      </div>
    </div>
  );
}
