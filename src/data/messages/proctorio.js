/**
 * Custom integration with Proctorio browser extension
 *
 * Note: this is a temporary solution, we would like to avoid
 * vendor-specific integrations long term. As of now these events
 * will trigger on ANY lti integration, not just Proctorio.
 */
import { getConfig } from '@edx/frontend-platform';

export async function checkAppStatus() {
  return new Promise((resolve, reject) => {
    const handleResponse = event => {
      if (event.origin === getConfig().EXAMS_BASE_URL) {
        window.removeEventListener('message', handleResponse);
        if (event?.data?.active) {
          resolve();
        } else {
          reject();
        }
      }
    };
    window.addEventListener('message', handleResponse);
    window.top.postMessage(['proctorio_status'], '*');
  });
}

export function notifyStartExam() {
  window.top.postMessage(
    ['exam_state_change', 'exam_take'],
    '*', // this isn't emitting secure data so any origin is fine
  );
}
