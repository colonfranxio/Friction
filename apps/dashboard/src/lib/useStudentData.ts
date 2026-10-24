import { useCallback, useEffect, useRef, useState } from 'react';
import type { StudentStateResponse } from '@friction/shared';
import { api } from './api';

/** Refresh on focus so an educator's tree reassignment is picked up across tabs. */
export function useStudentData(studentId: string | undefined) {
  const [student, setStudent] = useState<StudentStateResponse>();
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    if (!studentId) return;
    const request = ++sequence.current;
    try {
      const profile = await api.getStudent(studentId);
      if (request === sequence.current) { setStudent(profile); setError(''); }
    } catch (err) {
      if (request === sequence.current) setError(err instanceof Error ? err.message : 'Could not load your profile.');
    }
  }, [studentId]);
  useEffect(() => {
    setStudent(undefined); setError(''); void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { sequence.current++; window.removeEventListener('focus', onFocus); };
  }, [refresh]);
  return { student, error, refresh };
}
