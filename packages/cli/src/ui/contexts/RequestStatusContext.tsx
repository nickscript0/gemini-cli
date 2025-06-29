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

export interface RequestStatus {
  id: string;
  type: 'prompt' | 'json' | 'content';
  description: string;
  size: number;
  startTime: number;
  status: 'active' | 'completed' | 'error';
}

interface RequestStatusContextType {
  currentRequest: RequestStatus | null;
  duration: number;
  startRequest: (request: Omit<RequestStatus, 'startTime' | 'status'>) => void;
  endRequest: (id: string, status: 'completed' | 'error') => void;
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

  // Timer effect to update duration
  useEffect(() => {
    if (!currentRequest || currentRequest.status !== 'active') {
      setDuration(0);
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
  };

  const endRequest = (id: string, status: 'completed' | 'error') => {
    setCurrentRequest((prev) => {
      if (prev && prev.id === id) {
        return { ...prev, status };
      }
      return prev;
    });

    // Clear the request after a short delay to show completion status
    setTimeout(() => {
      setCurrentRequest((prev) => {
        if (prev && prev.id === id) {
          return null;
        }
        return prev;
      });
      setDuration(0);
    }, 1000);
  };

  return (
    <RequestStatusContext.Provider
      value={{
        currentRequest,
        duration,
        startRequest,
        endRequest,
      }}
    >
      {children}
    </RequestStatusContext.Provider>
  );
};
