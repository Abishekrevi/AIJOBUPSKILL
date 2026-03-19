import { useState, useEffect } from 'react';
import { useWorker } from '../hooks/useWorker';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function AIInsights() {
  const { worker } = useWorker();
  const [prediction, setPrediction] = useState(null);
  const [success, setSuccess] = useState(null);
  const [skillGaps, setSkillGaps] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!worker?.id) return;
    
    const fetchInsights = async () => {
      try {
        setLoading(true);
        
        const [pred, succ, gaps] = await Promise.all([
          fetch(${API_URL}/api/dl/predict-success/${worker.id}).then(r => r.json()),
          fetch(${API_URL}/api/dl/predict-completion/${worker.id}/cred1).then(r => r.json()).catch(() => null),
          fetch(${API_URL}/api/dl/skill-gap-analysis/${worker.id}?target_role=${worker.current_role}).then(r => r.json()).catch(() => null)
        ]);
        
        setPrediction(pred);
        setSuccess(succ);
        setSkillGaps(gaps);
      } catch (err) {
        console.error('Error fetching insights:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchInsights();
  }, [worker?.id]);

  if (loading) return <div className="p-4">Loading AI Insights...</div>;

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">AI-Powered Insights</h1>

      {prediction && (
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-lg mb-6">
          <h2 className="text-2xl font-bold mb-2">Success Prediction</h2>
          <div className="text-5xl font-bold mb-2">{prediction.success_prediction}%</div>
          <p className="text-blue-100">{prediction.recommendation}</p>
          <p className="text-sm mt-2">Based on {prediction.enrollments} enrollments, {prediction.completed} completed</p>
        </div>
      )}

      {skillGaps && (
        <div className="bg-white border rounded-lg p-6 mb-6 shadow">
          <h2 className="text-xl font-bold mb-4">Skill Gap Analysis</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-600">Readiness Score</p>
              <p className="text-3xl font-bold text-green-600">{skillGaps.readiness_score}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Skills to Master</p>
              <p className="text-3xl font-bold text-orange-600">{skillGaps.skill_gaps.length}</p>
            </div>
          </div>
          <div>
            <p className="font-semibold mb-2">Missing Skills:</p>
            <div className="flex flex-wrap gap-2">
              {skillGaps.skill_gaps.slice(0, 8).map((skill, i) => (
                <span key={i} className="bg-red-100 text-red-800 px-3 py-1 rounded text-sm">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Personalized Learning Path</h2>
        <p className="text-gray-700">Based on your current progress and target role, we recommend:</p>
        <ul className="list-disc ml-6 mt-3 text-gray-700">
          <li>Advanced Python for Data Science</li>
          <li>Machine Learning Fundamentals</li>
          <li>SQL & Database Management</li>
        </ul>
      </div>
    </div>
  );
}
