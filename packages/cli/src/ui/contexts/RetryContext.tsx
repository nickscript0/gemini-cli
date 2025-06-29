/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface RetryContextType {
  consecutive429Count: number;
  setConsecutive429Count: (count: number) => void;
}

const RetryContext = createContext<RetryContextType | undefined>(undefined);

export const RetryProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [consecutive429Count, setConsecutive429Count] = useState(0);

  return (
    <RetryContext.Provider
      value={{ consecutive429Count, setConsecutive429Count }}
    >
      {children}
    </RetryContext.Provider>
  );
};

export const useRetryContext = (): RetryContextType => {
  const context = useContext(RetryContext);
  if (context === undefined) {
    throw new Error('useRetryContext must be used within a RetryProvider');
  }
  return context;
};
