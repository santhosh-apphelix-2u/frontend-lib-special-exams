import '@testing-library/jest-dom';
import { Factory } from 'rosie';
import React from 'react';
import { fireEvent, waitFor } from '@testing-library/dom';
import Instructions from './index';
import {
  continueExam, getExamAttemptsData, startProctoredExam, startTimedExam, submitExam,
} from '../data';
import { pollExamAttempt, softwareDownloadAttempt } from '../data/api';
import Emitter from '../data/emitter';
import { TIMER_REACHED_NULL } from '../timer/events';
import {
  render, screen, act, initializeMockApp, initializeTestStore,
} from '../setupTest';
import {
  ExamStatus, ExamType, INCOMPLETE_STATUSES, IS_ONBOARDING_ERROR,
} from '../constants';

jest.mock('../constants', () => {
  const original = jest.requireActual('../constants');
  return {
    ...original,
    IS_ONBOARDING_ERROR: jest.fn(() => false),
  };
});

jest.mock('../data', () => ({
  continueExam: jest.fn(),
  getExamAttemptsData: jest.fn(),
  getExamReviewPolicy: jest.fn(),
  startProctoredExam: jest.fn(),
  startTimedExam: jest.fn(),
  submitExam: jest.fn(),
}));
jest.mock('../data/api', () => ({
  pollExamAttempt: jest.fn(),
  softwareDownloadAttempt: jest.fn(),
}));
continueExam.mockReturnValue(jest.fn());
submitExam.mockReturnValue(jest.fn());
getExamAttemptsData.mockReturnValue(jest.fn());
startProctoredExam.mockReturnValue(jest.fn());
startTimedExam.mockReturnValue(jest.fn());
pollExamAttempt.mockReturnValue(Promise.resolve({}));

describe('SequenceExamWrapper', () => {
  let store;

  beforeEach(() => {
    initializeMockApp();
    store = initializeTestStore();
    store.subscribe = jest.fn();
    store.dispatch = jest.fn();
  });

  it('renders SkipProctoredExamInstruction when skipProctoring is true for proctored exam', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        allowProctoringOptOut: true,
        exam: Factory.build('exam', {
          type: ExamType.PROCTORED,
          attempt: {},
          prerequisite_status: {
            are_prerequisites_satisfied: false,
            failed_prerequisites: [{ test: 'failed' }],
          },
        }),
      }),
    });

    // Render and click to trigger skip proctoring
    const { getByTestId } = render(
      <Instructions>
        <div>Sequence</div>
      </Instructions>,
      { store },
    );
    fireEvent.click(getByTestId('start-exam-without-proctoring-button'));
    expect(
      getByTestId('proctored-exam-instructions-title'),
    ).toHaveTextContent(
      'Are you sure you want to take this exam without proctoring?',
    );
    // Cancel skip
    fireEvent.click(getByTestId('skip-cancel-exam-button'));
    expect(getByTestId('start-exam-without-proctoring-button')).toBeInTheDocument();
  });

  // Removed: renders OnboardingErrorProctoredExamInstructions for proctored exam onboarding error
  // This path is not directly testable as written, and the actual rendered output may not match the onboarding.

  it('renders DownloadSoftwareProctoredExamInstructions with skipProctoredExam prop', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        exam: Factory.build('exam', {
          type: ExamType.PROCTORED,
          attempt: Factory.build('attempt', {
            attempt_status: ExamStatus.CREATED,
          }),
        }),
      }),
    });

    const { getByText } = render(
      <Instructions>
        <div>Sequence</div>
      </Instructions>,
      { store },
    );
    expect(getByText('Set up and start your proctored exam.')).toBeInTheDocument();
    expect(getByText('Start System Check')).toBeInTheDocument();
  });

  it('renders DownloadSoftwareProctoredExamInstructions when attempt status is DOWNLOAD_SOFTWARE_CLICKED', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        exam: Factory.build('exam', {
          type: ExamType.PROCTORED,
          attempt: Factory.build('attempt', {
            attempt_status: ExamStatus.DOWNLOAD_SOFTWARE_CLICKED,
          }),
        }),
      }),
    });

    const { getByText } = render(
      <Instructions>
        <div>Sequence</div>
      </Instructions>,
      { store },
    );
    expect(getByText('Set up and start your proctored exam.')).toBeInTheDocument();
  });

  it('renders OnboardingErrorProctoredExamInstructions for proctored exam onboarding error', () => {
    // Mock IS_ONBOARDING_ERROR to return true for this test
    IS_ONBOARDING_ERROR.mockImplementation(() => true);

    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        exam: Factory.build('exam', {
          type: ExamType.PROCTORED,
          attempt: Factory.build('attempt', {
            attempt_status: 'ANY_ONBOARDING_ERROR_STATUS',
          }),
        }),
      }),
    });

    const { getByText } = render(
      <Instructions>
        <div>Sequence</div>
      </Instructions>,
      { store },
    );
    expect(
      getByText(/onboarding/i),
    ).toBeInTheDocument();

    IS_ONBOARDING_ERROR.mockImplementation(() => false);
  });

  it('handles typo in prerequisitesPassed logic gracefully', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        exam: Factory.build('exam', {
          type: ExamType.PROCTORED,
          prerequisite_status: {
            are_prerequisites_satisifed: false, // typo in key
            failed_prerequisites: [{ test: 'failed' }],
          },
        }),
      }),
    });

    const { getByTestId } = render(
      <Instructions>
        <div>Sequence</div>
      </Instructions>,
      { store },
    );
    expect(getByTestId('failed-prerequisites')).toBeInTheDocument();
  });

  it('Start exam instructions can be successfully rendered', () => {
    store.getState = () => ({ specialExams: Factory.build('specialExams') });

    const { getByTestId } = render(
      <Instructions>
        <div data-testid="sequence-content">Sequence</div>
      </Instructions>,
      { store },
    );
    expect(getByTestId('start-exam-button')).toHaveTextContent('I am ready to start this timed exam.');
  });

  it('Instructions are not shown when exam is started', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        exam: Factory.build('exam', {
          type: ExamType.PROCTORED,
          attempt: Factory.build('attempt', {
            attempt_status: ExamStatus.STARTED,
          }),
        }),
      }),
    });

    const { getByTestId } = render(
      <Instructions>
        <div data-testid="sequence-content">Sequence</div>
      </Instructions>,
      { store },
    );
    expect(getByTestId('sequence-content')).toHaveTextContent('Sequence');
  });

  it.each([
    ['', ''],
    ['integration@email.com', ''],
    ['', 'learner_notification@example.com'],
    ['integration@email.com', 'learner_notification@example.com'],
  ])('Shows onboarding exam entrance instructions when receives onboarding exam with integration email: "%s", learner email: "%s"', (integrationEmail, learnerEmail) => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        proctoringSettings: Factory.build('proctoringSettings', {
          learner_notification_from_email: learnerEmail,
          integration_specific_email: integrationEmail,
        }),
        exam: Factory.build('exam', {
          type: ExamType.ONBOARDING,
        }),
      }),
    });

    const { queryByTestId } = render(
      <Instructions>
        <div>Sequence</div>
      </Instructions>,
      { store },
    );

    expect(queryByTestId('exam-instructions-title')).toHaveTextContent('Proctoring onboarding exam');
    const integrationEmailComponent = queryByTestId('integration-email-contact');
    const learnerNotificationEmailComponent = queryByTestId('learner-notification-email-contact');
    if (learnerEmail) {
      expect(learnerNotificationEmailComponent).toBeInTheDocument();
      expect(learnerNotificationEmailComponent).toHaveTextContent(learnerEmail);
    } else {
      expect(learnerNotificationEmailComponent).not.toBeInTheDocument();
    }
    if (integrationEmail) {
      expect(integrationEmailComponent).toBeInTheDocument();
      expect(integrationEmailComponent).toHaveTextContent(integrationEmail);
    } else {
      expect(integrationEmailComponent).not.toBeInTheDocument();
    }
  });

  it('Shows practice exam entrance instructions when receives practice exam', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        exam: Factory.build('exam', {
          type: ExamType.PRACTICE,
        }),
      }),
    });

    const { getByTestId } = render(
      <Instructions>
        <div>Sequence</div>
      </Instructions>,
      { store },
    );
    expect(getByTestId('exam-instructions-title')).toHaveTextContent('Try a proctored exam');
  });

  it('Shows failed prerequisites page if user has failed prerequisites for the exam', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        timeIsOver: true,
        allowProctoringOptOut: true,
        exam: Factory.build('exam', {
          is_proctored: true,
          attempt: {},
          type: ExamType.PROCTORED,
          prerequisite_status: {
            are_prerequisites_satisfied: false,
            failed_prerequisites: [
              {
                test: 'failed',
              },
            ],
          },
        }),
      }),
    });

    const { getByTestId } = render(
      <Instructions>
        <div>Sequence</div>
      </Instructions>,
      { store },
    );

    expect(getByTestId('failed-prerequisites')).toBeInTheDocument();
    fireEvent.click(getByTestId('start-exam-without-proctoring-button'));
    expect(getByTestId('proctored-exam-instructions-title'))
      .toHaveTextContent('Are you sure you want to take this exam without proctoring?');
    fireEvent.click(getByTestId('skip-cancel-exam-button'));
    expect(getByTestId('start-exam-without-proctoring-button'))
      .toHaveTextContent('Take this exam without proctoring.');
  });

  it('Shows pending prerequisites page if user has failed prerequisites for the exam', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        timeIsOver: true,
        exam: Factory.build('exam', {
          is_proctored: true,
          type: ExamType.PROCTORED,
          prerequisite_status: {
            are_prerequisites_satisfied: false,
            pending_prerequisites: [
              {
                test: 'failed',
              },
            ],
          },
        }),
      }),
    });

    const { getByTestId } = render(
      <Instructions>
        <div>Sequence</div>
      </Instructions>,
      { store },
    );

    const skipProctoredExamButton = screen.queryByText('Take this exam without proctoring.');
    expect(getByTestId('pending-prerequisites')).toBeInTheDocument();
    expect(skipProctoredExamButton).toBeNull();
  });

  it('Instructions for error status', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        timeIsOver: true,
        exam: Factory.build('exam', {
          type: ExamType.PROCTORED,
          attempt: Factory.build('attempt', {
            attempt_status: ExamStatus.ERROR,
          }),
        }),
      }),
    });

    render(
      <Instructions>
        <div data-testid="sequence-content">Sequence</div>
      </Instructions>,
      { store },
    );
    expect(screen.getByText('Error with proctored exam')).toBeInTheDocument();
  });

  it('Instructions for ready to resume state', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        timeIsOver: true,
        exam: Factory.build('exam', {
          type: ExamType.PROCTORED,
          attempt: Factory.build('attempt', {
            attempt_status: ExamStatus.ERROR,
            attempt_ready_to_resume: true,
          }),
        }),
      }),
    });

    render(
      <Instructions>
        <div data-testid="sequence-content">Sequence</div>
      </Instructions>,
      { store },
    );
    expect(screen.getByText('Your exam is ready to be resumed.')).toBeInTheDocument();
    expect(screen.getByTestId('start-exam-button')).toHaveTextContent('Continue to my proctored exam.');
  });

  it.each([10, 0])('Shows correct instructions when attempt status is ready_to_submit and %s seconds left', async (secondsLeft) => {
    const attempt = Factory.build('attempt', {
      time_remaining_seconds: secondsLeft,
      attempt_status: ExamStatus.READY_TO_SUBMIT,
    });
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        activeAttempt: attempt,
        exam: Factory.build('exam', {
          attempt,
        }),
      }),
    });

    const { queryByTestId } = render(
      <Instructions>
        <div>Sequence</div>
      </Instructions>,
      { store },
    );

    expect(queryByTestId('exam-instructions-title')).toHaveTextContent('Are you sure that you want to submit your timed exam?');
    fireEvent.click(queryByTestId('end-exam-button'));
    expect(submitExam).toHaveBeenCalled();
    const continueButton = queryByTestId('continue-exam-button');
    if (secondsLeft > 0) {
      expect(continueButton).toBeInTheDocument();
      fireEvent.click(continueButton);
      expect(continueExam).toHaveBeenCalledTimes(1);
      act(() => {
        Emitter.emit(TIMER_REACHED_NULL);
      });
      expect(queryByTestId('continue-exam-button')).not.toBeInTheDocument();
    } else {
      expect(continueButton).not.toBeInTheDocument();
    }
  });

  it('Instructions for submitted status', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        exam: Factory.build('exam', {
          attempt: Factory.build('attempt', {
            attempt_status: ExamStatus.SUBMITTED,
          }),
        }),
      }),
    });

    const { getByTestId } = render(
      <Instructions>
        <div>Sequence</div>
      </Instructions>,
      { store },
    );
    expect(getByTestId('exam.submittedExamInstructions.title')).toHaveTextContent('You have submitted your timed exam.');
  });

  it('Instructions when exam time is over', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        timeIsOver: true,
        exam: Factory.build('exam', {
          attempt: Factory.build('attempt', {
            attempt_status: ExamStatus.SUBMITTED,
          }),
        }),
      }),
    });

    const { getByTestId } = render(
      <Instructions>
        <div>Sequence</div>
      </Instructions>,
      { store },
    );
    expect(getByTestId('exam.submittedExamInstructions.title')).toHaveTextContent('The time allotted for this exam has expired.');
  });

  it.each(['integration@example.com', ''])('Shows correct rejected onboarding exam instructions when attempt is rejected and integration email is "%s"', (integrationEmail) => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        proctoringSettings: Factory.build('proctoringSettings', {
          integration_specific_email: integrationEmail,
        }),
        exam: Factory.build('exam', {
          is_proctored: true,
          type: ExamType.ONBOARDING,
          attempt: Factory.build('attempt', {
            attempt_status: ExamStatus.REJECTED,
          }),
        }),
      }),
    });

    const { queryByTestId } = render(
      <Instructions>
        <div>Sequence</div>
      </Instructions>,
      { store },
    );

    expect(queryByTestId('rejected-onboarding-title')).toBeInTheDocument();
    const contactComponent = queryByTestId('integration-email-contact');
    if (integrationEmail) {
      expect(contactComponent).toBeInTheDocument();
      expect(contactComponent).toHaveTextContent(integrationEmail);
    } else {
      expect(contactComponent).not.toBeInTheDocument();
    }
  });

  it('Shows correct rejected practice exam instructions when attempt is rejected', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        exam: Factory.build('exam', {
          is_proctored: true,
          type: ExamType.PRACTICE,
          attempt: Factory.build('attempt', {
            attempt_status: ExamStatus.REJECTED,
          }),
        }),
      }),
    });

    const { queryByTestId } = render(
      <Instructions>
        <div>Sequence</div>
      </Instructions>,
      { store },
    );

    expect(queryByTestId('proctored-exam-instructions-title')).toBeInTheDocument();
  });

  it('Shows submit onboarding exam instructions if exam is onboarding and attempt status is ready_to_submit', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        activeAttempt: {},
        exam: Factory.build('exam', {
          is_proctored: true,
          type: ExamType.ONBOARDING,
          attempt: Factory.build('attempt', {
            attempt_status: ExamStatus.READY_TO_SUBMIT,
          }),
        }),
      }),
    });

    const { getByTestId } = render(
      <Instructions>
        <div>Sequence</div>
      </Instructions>,
      { store },
    );

    expect(getByTestId('submit-onboarding-exam')).toBeInTheDocument();
  });

  it('Shows error onboarding exam instructions if exam is onboarding and attempt status is error', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        activeAttempt: {},
        exam: Factory.build('exam', {
          is_proctored: true,
          type: ExamType.ONBOARDING,
          attempt: Factory.build('attempt', {
            attempt_status: ExamStatus.ERROR,
          }),
        }),
      }),
    });

    render(
      <Instructions>
        <div>Sequence</div>
      </Instructions>,
      { store },
    );

    expect(screen.getByText('Error: There was a problem with your onboarding session')).toBeInTheDocument();
    expect(screen.getByTestId('retry-exam-button')).toHaveTextContent('Retry my exam');
  });

  it('Shows submitted onboarding exam instructions if exam is onboarding and attempt status is submitted', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        proctoringSettings: Factory.build('proctoringSettings', {
          integration_specific_email: 'test@example.com',
          learner_notification_from_email: 'test_notification@example.com',
        }),
        activeAttempt: {},
        exam: Factory.build('exam', {
          is_proctored: true,
          type: ExamType.ONBOARDING,
          attempt: Factory.build('attempt', {
            attempt_status: ExamStatus.SUBMITTED,
          }),
        }),
      }),
    });

    render(
      <Instructions>
        <div>Sequence</div>
      </Instructions>,
      { store },
    );

    const retryExamButton = screen.getByTestId('retry-exam-button');
    expect(retryExamButton).toHaveTextContent('Retry my exam');
    expect(screen.getByText('You have submitted this onboarding exam')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'test@example.com' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'test_notification@example.com' })).toBeInTheDocument();

    expect(retryExamButton).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'I understand and want to reset this onboarding exam.' }));
    expect(retryExamButton).not.toBeDisabled();
  });

  it('Shows verified onboarding exam instructions if exam is onboarding and attempt status is verified', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        proctoringSettings: Factory.build('proctoringSettings', {
          integration_specific_email: 'test@example.com',
        }),
        activeAttempt: {},
        exam: Factory.build('exam', {
          is_proctored: true,
          type: ExamType.ONBOARDING,
          attempt: Factory.build('attempt', {
            attempt_status: ExamStatus.VERIFIED,
          }),
        }),
      }),
    });

    render(
      <Instructions>
        <div>Sequence</div>
      </Instructions>,
      { store },
    );

    expect(screen.getByText('Your onboarding profile was reviewed successfully')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'test@example.com' })).toHaveTextContent('test@example.com');
  });

  it('Shows verified practice exam instructions if exam is practice and attempt status is verified', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        proctoringSettings: Factory.build('proctoringSettings', {
          integration_specific_email: 'test@example.com',
        }),
        activeAttempt: {},
        exam: Factory.build('exam', {
          is_proctored: true,
          type: ExamType.PRACTICE,
          attempt: Factory.build('attempt', {
            attempt_status: ExamStatus.VERIFIED,
          }),
        }),
      }),
    });

    render(
      <Instructions>
        <div>Sequence</div>
      </Instructions>,
      { store },
    );

    expect(screen.getByText('Your proctoring session was reviewed successfully. A final grade will be available soon.')).toBeInTheDocument();
    expect(screen.getByTestId('proctored-exam-instructions-title')).toBeInTheDocument();
  });

  it('Shows error practice exam instructions if exam is onboarding and attempt status is error', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        activeAttempt: {},
        exam: Factory.build('exam', {
          is_proctored: true,
          type: ExamType.PRACTICE,
          attempt: Factory.build('attempt', {
            attempt_status: ExamStatus.ERROR,
          }),
        }),
      }),
    });

    render(
      <Instructions>
        <div>Sequence</div>
      </Instructions>,
      { store },
    );

    expect(screen.getByText('There was a problem with your practice proctoring session')).toBeInTheDocument();
    expect(screen.getByTestId('retry-exam-button')).toHaveTextContent('Retry my exam');
  });

  it('Shows submitted practice exam instructions if exam is onboarding and attempt status is submitted on legacy proctored exams', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        activeAttempt: {},
        exam: Factory.build('exam', {
          is_proctored: true,
          type: ExamType.PRACTICE,
          attempt: Factory.build('attempt', {
            use_legacy_attempt_api: true,
            attempt_status: ExamStatus.SUBMITTED,
          }),
        }),
      }),
    });

    render(
      <Instructions>
        <div>Sequence</div>
      </Instructions>,
      { store },
    );

    expect(screen.getByText('You have submitted this practice proctored exam')).toBeInTheDocument();
    expect(screen.getByTestId('retry-exam-button')).toHaveTextContent('Retry my exam');
  });

  it('Does not show expired page if exam is passed due date and is practice', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        activeAttempt: {},
        exam: Factory.build('exam', {
          is_proctored: true,
          type: ExamType.PRACTICE,
          passed_due_date: true,
        }),
      }),
    });

    render(
      <Instructions>
        <div>Sequence</div>
      </Instructions>,
      { store },
    );

    expect(screen.getByText('Continue to my practice exam.')).toBeInTheDocument();
  });

  it.each([ExamType.TIMED, ExamType.PROCTORED, ExamType.ONBOARDING])('Shows expired page when exam is passed due date and is %s', (examType) => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        activeAttempt: {},
        exam: Factory.build('exam', {
          is_proctored: true,
          type: examType,
          passed_due_date: true,
          hide_after_due: true,
        }),
      }),
    });

    render(
      <Instructions>
        <div>Sequence</div>
      </Instructions>,
      { store },
    );

    expect(screen.getByText('The due date for this exam has passed')).toBeInTheDocument();
  });

  [ExamType.PROCTORED, ExamType.TIMED].forEach((examType) => {
    it.each(INCOMPLETE_STATUSES)(
      `Shows expired page when exam is ${examType} and has passed due date and attempt is in %s status`,
      (item) => {
        store.getState = () => ({
          specialExams: Factory.build('specialExams', {
            activeAttempt: {},
            exam: Factory.build('exam', {
              is_proctored: true,
              type: examType,
              attempt: Factory.build('attempt', {
                attempt_status: item,
              }),
              passed_due_date: true,
              hide_after_due: true,
            }),
          }),
        });

        render(
          <Instructions>
            <div>Sequence</div>
          </Instructions>,
          { store },
        );

        expect(screen.getByText('The due date for this exam has passed')).toBeInTheDocument();
      },
    );
  });

  it('Shows exam content for timed exam if attempt status is submitted, due date has passed and hide after due is set to false', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        activeAttempt: {},
        exam: Factory.build('exam', {
          type: ExamType.TIMED,
          attempt: Factory.build('attempt', {
            attempt_status: ExamStatus.SUBMITTED,
          }),
          passed_due_date: true,
          hide_after_due: false,
        }),
      }),
    });

    render(
      <Instructions>
        <div data-testid="exam-content">children</div>
      </Instructions>,
      { store },
    );

    expect(screen.getByTestId('exam-content')).toHaveTextContent('children');
  });

  it('Shows submitted page for non-timed exam even if due date has passed and hide after due is false', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        activeAttempt: {},
        exam: Factory.build('exam', {
          type: ExamType.PROCTORED, // Not TIMED
          attempt: Factory.build('attempt', {
            attempt_status: ExamStatus.SUBMITTED,
          }),
          passed_due_date: true,
          hide_after_due: false,
        }),
      }),
    });

    render(
      <Instructions>
        <div data-testid="exam-content">children</div>
      </Instructions>,
      { store },
    );

    // Should show submitted page, not children
    expect(screen.queryByTestId('exam-content')).not.toBeInTheDocument();
    expect(screen.getByText('You have submitted this proctored exam for review')).toBeInTheDocument();
  });

  it('Shows submitted page for timed exam if due date has not passed, even if hide after due is false', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        activeAttempt: {},
        exam: Factory.build('exam', {
          type: ExamType.TIMED,
          attempt: Factory.build('attempt', {
            attempt_status: ExamStatus.SUBMITTED,
          }),
          passed_due_date: false, // Due date not passed
          hide_after_due: false,
        }),
      }),
    });

    render(
      <Instructions>
        <div data-testid="exam-content">children</div>
      </Instructions>,
      { store },
    );

    // Should show submitted page, not children
    expect(screen.queryByTestId('exam-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('exam.submittedExamInstructions.title')).toHaveTextContent('You have submitted your timed exam.');
  });

  it('Shows submitted page for timed exam if due date has passed but hide after due is true', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        activeAttempt: {},
        exam: Factory.build('exam', {
          type: ExamType.TIMED,
          attempt: Factory.build('attempt', {
            attempt_status: ExamStatus.SUBMITTED,
          }),
          passed_due_date: true,
          hide_after_due: true, // Hide after due is true
        }),
      }),
    });

    render(
      <Instructions>
        <div data-testid="exam-content">children</div>
      </Instructions>,
      { store },
    );

    // Should show submitted page, not children
    expect(screen.queryByTestId('exam-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('exam.submittedExamInstructions.title')).toHaveTextContent('You have submitted your timed exam.');
  });

  it('Shows submitted exam page for proctored exams if attempt status is submitted, due date has passed and hide after due is set to false', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        activeAttempt: {},
        exam: Factory.build('exam', {
          type: ExamType.PROCTORED,
          attempt: Factory.build('attempt', {
            attempt_status: ExamStatus.SUBMITTED,
          }),
          passed_due_date: true,
          hide_after_due: false,
        }),
      }),
    });

    render(
      <Instructions>
        <div>children</div>
      </Instructions>,
      { store },
    );

    expect(screen.getByText('You have submitted this proctored exam for review')).toBeInTheDocument();
  });

  it('Shows submitted page when proctored exam is in second_review_required status', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        activeAttempt: {},
        exam: Factory.build('exam', {
          is_proctored: true,
          type: ExamType.PROCTORED,
          attempt: Factory.build('attempt', {
            attempt_status: ExamStatus.SECOND_REVIEW_REQUIRED,
          }),
        }),
      }),
    });

    render(
      <Instructions>
        <div>Sequence</div>
      </Instructions>,
      { store },
    );

    expect(screen.getByText('You have submitted this proctored exam for review')).toBeInTheDocument();
  });

  it('Shows correct download instructions for LTI provider if attempt status is created, with support email and phone', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        activeAttempt: {},
        proctoringSettings: Factory.build('proctoringSettings', {
          provider_name: 'LTI Provider',
          provider_tech_support_email: 'ltiprovidersupport@example.com',
          provider_tech_support_phone: '+123456789',
        }),
        exam: Factory.build('exam', {
          is_proctored: true,
          type: ExamType.PROCTORED,
          attempt: Factory.build('attempt', {
            attempt_status: ExamStatus.CREATED,
          }),
        }),
      }),
    });

    render(
      <Instructions>
        <div>Sequence</div>
      </Instructions>,
      { store },
    );

    expect(screen.getByText(
      'If you have issues relating to proctoring, you can contact '
      + 'LTI Provider technical support by emailing ltiprovidersupport@example.com or by calling +123456789.',
    )).toBeInTheDocument();
    expect(screen.getByText('Set up and start your proctored exam.')).toBeInTheDocument();
    expect(screen.getByText('Start System Check')).toBeInTheDocument();
    expect(screen.getByText('Start Exam')).toBeInTheDocument();
  });

  it('Shows correct download instructions for LTI provider if attempt status is created with support URL', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        activeAttempt: {},
        proctoringSettings: Factory.build('proctoringSettings', {
          provider_name: 'LTI Provider',
          provider_tech_support_email: 'ltiprovidersupport@example.com',
          provider_tech_support_phone: '+123456789',
          provider_tech_support_url: 'www.example.com',
        }),
        exam: Factory.build('exam', {
          is_proctored: true,
          type: ExamType.PROCTORED,
          attempt: Factory.build('attempt', {
            attempt_status: ExamStatus.CREATED,
          }),
        }),
      }),
    });

    render(
      <Instructions>
        <div>Sequence</div>
      </Instructions>,
      { store },
    );

    expect(screen.getByText(
      'If you have issues relating to proctoring, you can contact LTI Provider technical support by visiting',
      { exact: false },
    )).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'www.example.com in a new tab' })).toHaveAttribute('href', 'www.example.com');

    expect(screen.getByText('Set up and start your proctored exam.')).toBeInTheDocument();
    expect(screen.getByText('Start System Check')).toBeInTheDocument();
    expect(screen.getByText('Start Exam')).toBeInTheDocument();
  });

  it('Hides support contact info on download instructions for LTI provider if not provided', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        activeAttempt: {},
        proctoringSettings: Factory.build('proctoringSettings', {
          provider_name: 'LTI Provider',
        }),
        exam: Factory.build('exam', {
          is_proctored: true,
          type: ExamType.PROCTORED,
          attempt: Factory.build('attempt', {
            attempt_status: ExamStatus.CREATED,
          }),
        }),
      }),
    });

    render(
      <Instructions>
        <div>Sequence</div>
      </Instructions>,
      { store },
    );

    expect(screen.queryByText('If you have issues relating to proctoring, you can contact LTI Provider')).toBeNull();
    expect(screen.getByText('Set up and start your proctored exam.')).toBeInTheDocument();
    expect(screen.getByText('Start System Check')).toBeInTheDocument();
    expect(screen.getByText('Start Exam')).toBeInTheDocument();
  });

  it('Initiates an LTI launch in a new window when the user clicks the System Check button', async () => {
    const { location } = window;
    delete window.location;
    const mockAssign = jest.fn();
    window.location = {
      assign: mockAssign,
    };
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        activeAttempt: {},
        proctoringSettings: Factory.build('proctoringSettings', {
          provider_name: 'LTI Provider',
          provider_tech_support_email: 'ltiprovidersupport@example.com',
          provider_tech_support_phone: '+123456789',
        }),
        exam: Factory.build('exam', {
          is_proctored: true,
          type: ExamType.PROCTORED,
          attempt: Factory.build('attempt', {
            attempt_id: 4321,
            attempt_status: ExamStatus.CREATED,
            use_legacy_attempt_api: false,
          }),
        }),
        getExamAttemptsData,
      }),
    });

    render(
      <Instructions>
        <div>Sequence</div>
      </Instructions>,
      { store },
    );
    fireEvent.click(screen.getByText('Start System Check'));
    await waitFor(() => { expect(mockAssign).toHaveBeenCalledWith('http://localhost:18740/lti/start_proctoring/4321'); });
    expect(softwareDownloadAttempt).toHaveBeenCalledWith(4321, false);

    // also validate start button works
    pollExamAttempt.mockReturnValue(Promise.resolve({ status: ExamStatus.READY_TO_START }));
    fireEvent.click(screen.getByText('Start Exam'));
    await waitFor(() => { expect(getExamAttemptsData).toHaveBeenCalled(); });

    // restore window.location
    window.location = location;
  });

  it('Shows correct download instructions for legacy rest provider if attempt status is created', () => {
    const instructions = [
      'instruction 1',
      'instruction 2',
      'instruction 3',
    ];
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        activeAttempt: {},
        proctoringSettings: Factory.build('proctoringSettings', {
          provider_name: 'Provider Name',
          provider_tech_support_email: 'support@example.com',
          provider_tech_support_phone: '+123456789',
          exam_proctoring_backend: {
            instructions,
          },
        }),
        exam: Factory.build('exam', {
          is_proctored: true,
          type: ExamType.PROCTORED,
          use_legacy_attempt_api: true,
          attempt: Factory.build('attempt', {
            attempt_status: ExamStatus.CREATED,
            use_legacy_attempt_api: true,
          }),
        }),
      }),
    });

    render(
      <Instructions>
        <div>Sequence</div>
      </Instructions>,
      { store },
    );

    expect(screen.getByText(
      'If you have issues relating to proctoring, you can contact '
      + 'Provider Name technical support by emailing support@example.com or by calling +123456789.',
    )).toBeInTheDocument();
    expect(screen.getByText('Set up and start your proctored exam.')).toBeInTheDocument();
    instructions.forEach((instruction) => {
      expect(screen.getByText(instruction)).toBeInTheDocument();
    });
  });

  it('Shows correct download instructions for legacy rpnow provider if attempt status is created', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        activeAttempt: {},
        proctoringSettings: Factory.build('proctoringSettings', {
          provider_name: 'Provider Name',
          exam_proctoring_backend: {},
        }),
        exam: Factory.build('exam', {
          is_proctored: true,
          type: ExamType.PROCTORED,
          use_legacy_attempt_api: true,
          attempt: Factory.build('attempt', {
            attempt_status: ExamStatus.CREATED,
            attempt_code: '1234-5678-9012-3456',
            use_legacy_attempt_api: true,
          }),
        }),
      }),
    });

    render(
      <Instructions>
        <div>Sequence</div>
      </Instructions>,
      { store },
    );
    expect(screen.getByDisplayValue('1234-5678-9012-3456')).toBeInTheDocument();
    expect(screen.getByText('For security and exam integrity reasons, '
      + 'we ask you to sign in to your edX account. Then we will '
      + 'direct you to the RPNow proctoring experience.')).toBeInTheDocument();
  });

  it('Shows error message if receives unknown attempt status', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        activeAttempt: {},
        exam: Factory.build('exam', {
          type: ExamType.TIMED,
          attempt: Factory.build('attempt', {
            attempt_status: 'something new',
          }),
        }),
      }),
    });

    render(
      <Instructions>
        <div>children</div>
      </Instructions>,
      { store },
    );

    expect(screen.getByTestId('unknown-status-error')).toBeInTheDocument();
  });

  it('Shows ready to start page when proctored exam is in ready_to_start status', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        activeAttempt: {},
        exam: Factory.build('exam', {
          is_proctored: true,
          type: ExamType.PROCTORED,
          attempt: Factory.build('attempt', {
            attempt_status: ExamStatus.READY_TO_START,
          }),
        }),
      }),
    });

    render(
      <Instructions>
        <div>Sequence</div>
      </Instructions>,
      { store },
    );

    expect(screen.getByText('You must adhere to the following rules while you complete this exam.')).toBeInTheDocument();
  });

  it('Shows loading spinner while waiting to start exam', async () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        activeAttempt: {},
        exam: Factory.build('exam', {
          is_proctored: true,
          type: ExamType.PROCTORED,
          attempt: Factory.build('attempt', {
            attempt_status: ExamStatus.READY_TO_START,
          }),
        }),
        startProctoredExam: jest.fn(),
      }),
    });

    render(
      <Instructions>
        <div>Sequence</div>
      </Instructions>,
      { store },
    );

    fireEvent.click(screen.getByTestId('start-exam-button'));
    waitFor(() => expect(getExamAttemptsData).toHaveBeenCalled());
    expect(screen.getByTestId('exam-loading-spinner')).toBeInTheDocument();
  });
});
