/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';

export interface RequestConfigDetails {
  toolsCount?: number;
  systemInstructionSnippet?: string;
  messageSnippet?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface RequestStatus {
  id: string;
  type: 'prompt' | 'json' | 'content';
  description: string;
  size: number;
  startTime: number;
  status: 'active' | 'completed' | 'error';
  configDetails?: RequestConfigDetails;
}

export interface RequestTypeCounts {
  prompt: number;
  json: number;
  content: number;
}

export interface TimelineEntry {
  abbreviation: string;
  duration: number;
  startTime: number;
  color: string;
}

export interface StatusPhaseTracker {
  currentPhase: string | null;
  phaseStartTime: number | null;
}

// Status message to abbreviation and color mapping
export const STATUS_ABBREVIATIONS: Record<
  string,
  { abbreviation: string; color: string }
> = {
  'Prompt Request': { abbreviation: 'PR', color: 'AccentBlue' },
  'Received Prompt Response': { abbreviation: 'RR', color: 'AccentGreen' },
  'Tool Call Request': { abbreviation: 'TC', color: 'AccentYellow' },
  'Tool Call Complete': { abbreviation: 'CC', color: 'AccentRed' },
};

// Format duration for timeline display
export const formatTimelineDuration = (durationMs: number): string => {
  if (durationMs < 1000) {
    return `${Math.round(durationMs)}ms`;
  }

  const seconds = Math.floor(durationMs / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${remainingSeconds}s`;
};

interface RequestStatusContextType {
  currentRequest: RequestStatus | null;
  duration: number;
  requestCounts: RequestTypeCounts;
  statusMessage: string | null;
  timeline: TimelineEntry[];
  startRequest: (request: Omit<RequestStatus, 'startTime' | 'status'>) => void;
  endRequest: (id: string, status: 'completed' | 'error') => void;
  resetRequestCounts: () => void;
  setStatusMessage: (message: string | null) => void;
  addTimelineEntry: (entry: TimelineEntry) => void;
  clearTimeline: () => void;
  markUserInputSubmitted: () => void;
}

const RequestStatusContext = createContext<
  RequestStatusContextType | undefined
>(undefined);

export const useRequestStatus = (): RequestStatusContextType => {
  const context = useContext(RequestStatusContext);
  if (!context) {
    throw new Error(
      'useRequestStatus must be used within a RequestStatusProvider',
    );
  }
  return context;
};

interface RequestStatusProviderProps {
  children: ReactNode;
}

export const RequestStatusProvider: React.FC<RequestStatusProviderProps> = ({
  children,
}) => {
  const [currentRequest, setCurrentRequest] = useState<RequestStatus | null>(
    null,
  );
  const [duration, setDuration] = useState<number>(0);
  const [requestCounts, setRequestCounts] = useState<RequestTypeCounts>({
    prompt: 0,
    json: 0,
    content: 0,
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [userInputSubmitted, setUserInputSubmitted] = useState<boolean>(false);

  // Timer effect to update duration
  useEffect(() => {
    if (!currentRequest || currentRequest.status !== 'active') {
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - currentRequest.startTime) / 1000;
      setDuration(elapsed);
    }, 100); // Update every 100ms for smooth display

    return () => clearInterval(interval);
  }, [currentRequest]);

  const startRequest = (
    request: Omit<RequestStatus, 'startTime' | 'status'>,
  ) => {
    const newRequest: RequestStatus = {
      ...request,
      startTime: Date.now(),
      status: 'active',
    };
    setCurrentRequest(newRequest);
    setDuration(0);

    // Clear timeline only for user-initiated prompt requests
    if (request.type === 'prompt' && userInputSubmitted) {
      clearTimeline();
      setUserInputSubmitted(false); // Reset the flag
    }

    // Increment the count for this request type
    setRequestCounts((prev) => ({
      ...prev,
      [request.type]: prev[request.type] + 1,
    }));
  };

  const endRequest = (id: string, status: 'completed' | 'error') => {
    setCurrentRequest((prev) => {
      if (prev && prev.id === id) {
        return { ...prev, status };
      }
      return prev;
    });
  };

  const resetRequestCounts = () => {
    setRequestCounts({
      prompt: 0,
      json: 0,
      content: 0,
    });
  };

  const addTimelineEntry = (entry: TimelineEntry) => {
    setTimeline((prev) => [...prev, entry]);
  };

  const clearTimeline = () => {
    setTimeline([]);
  };

  const markUserInputSubmitted = () => {
    setUserInputSubmitted(true);
  };

  return (
    <RequestStatusContext.Provider
      value={{
        currentRequest,
        duration,
        requestCounts,
        statusMessage,
        timeline,
        startRequest,
        endRequest,
        resetRequestCounts,
        setStatusMessage,
        addTimelineEntry,
        clearTimeline,
        markUserInputSubmitted,
      }}
    >
      {children}
    </RequestStatusContext.Provider>
  );
};
