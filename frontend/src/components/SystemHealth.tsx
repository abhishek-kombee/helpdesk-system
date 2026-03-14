'use client';

import { useState, useEffect, useRef } from 'react';
import { healthAPI } from '@/lib/api';

interface HealthData {
  requestRate: number;
  errorRate: number;
  p95Latency: number;
  status: string;
}

export default function SystemHealth() {
  const [health, setHealth] = useState<HealthData>({
    requestRate: 0,
    errorRate: 0,
    p95Latency: 0,
    status: 'checking',
  });
  const [dbStatus, setDbStatus] = useState<string>('checking');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchHealth = async () => {
    try {
      const healthRes = await healthAPI.check();
      const healthData = healthRes.data;

      setDbStatus(healthData.checks?.database?.status || 'unknown');

      // Try fetching Prometheus metrics for live stats
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        // Request rate: rate of http_requests_total over 1m
        const rateRes = await fetch(`http://localhost:9090/api/v1/query?query=sum(rate(http_requests_total[1m]))`);
        const rateData = await rateRes.json();
        const requestRate = rateData?.data?.result?.[0]?.value?.[1] 
          ? parseFloat(rateData.data.result[0].value[1]) * 60 
          : 0;

        // Error rate: percentage of 5xx responses
        const errRes = await fetch(`http://localhost:9090/api/v1/query?query=sum(rate(http_requests_total{status_code=~"5.."}[1m]))/sum(rate(http_requests_total[1m]))*100`);
        const errData = await errRes.json();
        const errorRate = errData?.data?.result?.[0]?.value?.[1]
          ? parseFloat(errData.data.result[0].value[1])
          : 0;

        // P95 latency
        const latRes = await fetch(`http://localhost:9090/api/v1/query?query=histogram_quantile(0.95,sum(rate(http_request_duration_seconds_bucket[1m]))by(le))`);
        const latData = await latRes.json();
        const p95Latency = latData?.data?.result?.[0]?.value?.[1]
          ? parseFloat(latData.data.result[0].value[1]) * 1000
          : 0;

        setHealth({
          requestRate: Math.round(requestRate * 10) / 10,
          errorRate: Math.round(errorRate * 100) / 100,
          p95Latency: Math.round(p95Latency * 10) / 10,
          status: 'healthy',
        });
      } catch {
        // Prometheus not available — just show health check status
        setHealth({
          requestRate: 0,
          errorRate: 0,
          p95Latency: healthData.checks?.database?.duration_ms || 0,
          status: healthData.status || 'healthy',
        });
      }
    } catch {
      setHealth(prev => ({ ...prev, status: 'unhealthy' }));
      setDbStatus('down');
    }
  };

  useEffect(() => {
    fetchHealth();
    intervalRef.current = setInterval(fetchHealth, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const getColor = (value: number, thresholds: [number, number]) => {
    if (value <= thresholds[0]) return 'green';
    if (value <= thresholds[1]) return 'yellow';
    return 'red';
  };

  const reqColor = getColor(health.requestRate > 0 ? 0 : 1, [0, 0]); // green if receiving requests
  const errColor = health.errorRate > 5 ? 'red' : health.errorRate > 1 ? 'yellow' : 'green';
  const latColor = health.p95Latency > 1000 ? 'red' : health.p95Latency > 500 ? 'yellow' : 'green';

  return (
    <div className="health-widget">
      <div className={`health-card ${health.status === 'healthy' ? 'green' : 'red'}`}>
        <div className="health-label">Request Rate</div>
        <div className="health-value">
          {health.requestRate.toFixed(1)}
          <span className="health-unit">req/min</span>
        </div>
        <div className="health-trend">
          <span className={`health-dot ${health.status === 'healthy' ? 'green' : 'red'}`} />
          <span style={{ color: 'var(--text-muted)' }}>
            {health.status === 'healthy' ? 'System operational' : 'System issues detected'}
          </span>
        </div>
      </div>

      <div className={`health-card ${errColor}`}>
        <div className="health-label">Error Rate</div>
        <div className="health-value">
          {health.errorRate.toFixed(2)}
          <span className="health-unit">%</span>
        </div>
        <div className="health-trend">
          <span className={`health-dot ${errColor}`} />
          <span style={{ color: 'var(--text-muted)' }}>
            {errColor === 'green' ? 'Below threshold' : errColor === 'yellow' ? 'Elevated' : 'Critical'}
          </span>
        </div>
      </div>

      <div className={`health-card ${latColor}`}>
        <div className="health-label">P95 Latency</div>
        <div className="health-value">
          {health.p95Latency.toFixed(1)}
          <span className="health-unit">ms</span>
        </div>
        <div className="health-trend">
          <span className={`health-dot ${latColor}`} />
          <span style={{ color: 'var(--text-muted)' }}>
            DB: {dbStatus === 'up' ? '✓ Connected' : '✗ Disconnected'}
          </span>
        </div>
      </div>
    </div>
  );
}
