import '@testing-library/jest-dom';
import React from 'react';
import { Factory } from 'rosie';
import { render, initializeTestStore } from '../setupTest';
import Exam from './Exam';
import { ExamStatus, ExamType } from '../constants';
import { getProctoringSettings } from '../data';

jest.mock('../data', () => {
  const originalModule = jest.requireActual('../data');
  return {
    ...originalModule,
    getProctoringSettings: jest.fn(),
  };
});

getProctoringSettings.mockReturnValue(jest.fn());

describe('Exam', () => {
  const defaultProps = {
    isGated: false,
    isTimeLimited: true,
    originalUserIsStaff: false,
    canAccessProctoredExams: true,
    children: <div data-testid="exam-content">Exam Content</div>,
  };

  let store;

  beforeEach(() => {
    jest.clearAllMocks();
    store = initializeTestStore({
      specialExams: Factory.build('specialExams', {
        isLoading: false,
      }),
    });
  });

  it('renders loading spinner when isLoading is true', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        isLoading: true,
      }),
    });

    const { queryByTestId } = render(
      <Exam {...defaultProps} />,
      { store },
    );

    expect(queryByTestId('spinner')).toBeInTheDocument();
  });

  it('renders exam content when not loading', () => {
    // For non-staff users with time-limited exams, content is wrapped in Instructions
    // So we need to check if the component renders without errors
    const { getByTestId } = render(
      <Exam {...defaultProps} isTimeLimited={false} />,
      { store },
    );

    // For non-time-limited exams, the content should be rendered directly
    expect(getByTestId('exam-content')).toBeInTheDocument();
  });

  it('renders timer when attempt status is started', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        activeAttempt: {
          attempt_status: ExamStatus.STARTED,
        },
      }),
    });

    const { getByTestId } = render(
      <Exam {...defaultProps} />,
      { store },
    );

    // Check for exam-timer which is part of the ExamTimerBlock
    expect(getByTestId('exam-timer')).toBeInTheDocument();
  });

  it('renders error message when apiErrorMsg exists', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        apiErrorMsg: 'Error message',
      }),
    });

    const { queryByTestId } = render(
      <Exam {...defaultProps} />,
      { store },
    );

    expect(queryByTestId('exam-api-error-component')).toBeInTheDocument();
  });

  it('renders access denied message when user cannot access proctored exams', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        exam: Factory.build('exam', {
          type: ExamType.PROCTORED,
        }),
      }),
    });

    const { queryByTestId } = render(
      <Exam {...defaultProps} canAccessProctoredExams={false} />,
      { store },
    );

    expect(queryByTestId('no-access')).toBeInTheDocument();
  });

  it('renders masquerade alert when staff is masquerading as learner', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        exam: Factory.build('exam', {
          type: ExamType.PROCTORED,
          attempt: {
            attempt_status: ExamStatus.CREATED,
          },
        }),
      }),
    });

    const { queryByTestId } = render(
      <Exam {...defaultProps} originalUserIsStaff />,
      { store },
    );

    expect(queryByTestId('masquerade-alert')).toBeInTheDocument();
  });

  it('does not render masquerade alert when learner is in the middle of the exam', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        exam: Factory.build('exam', {
          type: ExamType.PROCTORED,
          attempt: {
            attempt_status: ExamStatus.STARTED,
          },
        }),
      }),
    });

    const { queryByTestId } = render(
      <Exam {...defaultProps} originalUserIsStaff />,
      { store },
    );

    expect(queryByTestId('masquerade-alert')).not.toBeInTheDocument();
  });

  // This test specifically targets line 39 in Exam.jsx
  it('does not render masquerade alert for timed exam past due date that is not hidden', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        exam: Factory.build('exam', {
          type: ExamType.TIMED,
          attempt: {
            attempt_status: ExamStatus.SUBMITTED,
          },
          passed_due_date: true,
          hide_after_due: false,
        }),
      }),
    });

    const { queryByTestId } = render(
      <Exam {...defaultProps} originalUserIsStaff />,
      { store },
    );

    expect(queryByTestId('masquerade-alert')).not.toBeInTheDocument();
  });

  // Additional test to ensure the condition works correctly
  it('renders masquerade alert for timed exam past due date that is hidden', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        exam: Factory.build('exam', {
          type: ExamType.TIMED,
          attempt: {
            attempt_status: ExamStatus.SUBMITTED,
          },
          passed_due_date: true,
          hide_after_due: true,
        }),
      }),
    });

    const { queryByTestId } = render(
      <Exam {...defaultProps} originalUserIsStaff />,
      { store },
    );

    expect(queryByTestId('masquerade-alert')).toBeInTheDocument();
  });

  it('fetches proctoring settings for proctored exam types', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        exam: Factory.build('exam', {
          type: ExamType.PROCTORED,
          id: 123,
        }),
      }),
    });

    render(
      <Exam {...defaultProps} />,
      { store },
    );

    expect(getProctoringSettings).toHaveBeenCalled();
  });

  it('does not fetch proctoring settings for timed exam types', () => {
    store.getState = () => ({
      specialExams: Factory.build('specialExams', {
        exam: Factory.build('exam', {
          type: ExamType.TIMED,
          id: 123,
        }),
      }),
    });

    render(
      <Exam {...defaultProps} />,
      { store },
    );

    expect(getProctoringSettings).not.toHaveBeenCalled();
  });

  it('renders Instructions component for time-limited exams', () => {
    const { getByTestId } = render(
      <Exam {...defaultProps} />,
      { store },
    );

    // Check for exam-instructions-title which is part of the Instructions component
    expect(getByTestId('exam-instructions-title')).toBeInTheDocument();
  });

  it('renders direct content for non-time-limited exams', () => {
    const { container, queryByTestId } = render(
      <Exam {...defaultProps} isTimeLimited={false} />,
      { store },
    );

    // Direct content is rendered
    expect(queryByTestId('exam-content')).toBeInTheDocument();
    // Instructions component is not rendered
    expect(container.innerHTML).not.toContain('Instructions');
  });

  it('renders direct content for gated exams', () => {
    const { container, queryByTestId } = render(
      <Exam {...defaultProps} isGated />,
      { store },
    );

    // Direct content is rendered
    expect(queryByTestId('exam-content')).toBeInTheDocument();
    // Instructions component is not rendered
    expect(container.innerHTML).not.toContain('Instructions');
  });

  it('renders direct content for staff users', () => {
    const { container, queryByTestId } = render(
      <Exam {...defaultProps} originalUserIsStaff />,
      { store },
    );

    // Direct content is rendered
    expect(queryByTestId('exam-content')).toBeInTheDocument();
    // Instructions component is not rendered
    expect(container.innerHTML).not.toContain('Instructions');
  });
});
