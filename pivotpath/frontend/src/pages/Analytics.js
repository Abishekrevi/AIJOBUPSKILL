import React, { useState, useEffect } from 'react';
import { useWorker } from '../App';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function Analytics() {
  const { worker } = useWorker();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!worker?.id) return;
    
    const fetchAnalytics = async () => {
      try {
        const res = await fetch(\\/api/analytics/dashboard/\\);
        const data = await res.json();
        setAnalytics(data);
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAnalytics();
  }, [worker?.id]);

  if (loading) return <div className="p-4">Loading...</div>;
  if (!analytics) return <div className="p-4">No data</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Your Learning Analytics</h1>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-blue-50 p-6 rounded-lg border">
          <p className="text-sm text-gray-600">Credentials Earned</p>
          <p className="text-3xl font-bold text-blue-600">{analytics.metrics.completed}</p>
        </div>
        <div className="bg-green-50 p-6 rounded-lg border">
          <p className="text-sm text-gray-600">Completion Rate</p>
          <p className="text-3xl font-bold text-green-600">{analytics.metrics.completion_rate}%</p>
        </div>
        <div className="bg-purple-50 p-6 rounded-lg border">
          <p className="text-sm text-gray-600">Hours Invested</p>
          <p className="text-3xl font-bold text-purple-600">{analytics.metrics.total_hours_invested}</p>
        </div>
        <div className="bg-orange-50 p-6 rounded-lg border">
          <p className="text-sm text-gray-600">Status</p>
          <p className="text-lg font-bold text-orange-600">{analytics.activity_trend}</p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-lg">
        <h3 className="text-lg font-bold mb-3">Recommendations</h3>
        <ul className="space-y-2">
          {analytics.recommendations.map((rec, i) => (
            <li key={i}>? {rec}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
