/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import { Colors } from '../colors.js';
import { shortenPath, tildeifyPath, tokenLimit } from '@google/gemini-cli-core';
import { ConsoleSummaryDisplay } from './ConsoleSummaryDisplay.js';
import process from 'node:process';
import { MemoryUsageDisplay } from './MemoryUsageDisplay.js';
import { useRetryContext } from '../contexts/RetryContext.js';
import { useRequestStatus } from '../contexts/RequestStatusContext.js';

interface FooterProps {
  model: string;
  targetDir: string;
  branchName?: string;
  debugMode: boolean;
  debugMessage: string;
  corgiMode: boolean;
  errorCount: number;
  showErrorDetails: boolean;
  showMemoryUsage?: boolean;
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

export const Footer: React.FC<FooterProps> = ({
  model,
  targetDir,
  branchName,
  debugMode,
  debugMessage,
  corgiMode,
  errorCount,
  showErrorDetails,
  showMemoryUsage,
  totalTokenCount,
}) => {
  const limit = tokenLimit(model);
  const percentage = totalTokenCount / limit;
  const { consecutive429Count } = useRetryContext();
  const { currentRequest, duration } = useRequestStatus();

  return (
    <Box flexDirection="column" marginTop={1} width="100%">
      {/* Main Footer Line */}
      <Box justifyContent="space-between" width="100%">
        <Box>
          <Text color={Colors.LightBlue}>
            {shortenPath(tildeifyPath(targetDir), 70)}
            {branchName && <Text color={Colors.Gray}> ({branchName}*)</Text>}
          </Text>
          {debugMode && (
            <Text color={Colors.AccentRed}>
              {' ' + (debugMessage || '--debug')}
            </Text>
          )}
        </Box>

        {/* Middle Section: Centered Sandbox Info */}
        <Box
          flexGrow={1}
          alignItems="center"
          justifyContent="center"
          display="flex"
        >
          {process.env.SANDBOX && process.env.SANDBOX !== 'sandbox-exec' ? (
            <Text color="green">
              {process.env.SANDBOX.replace(/^gemini-(?:cli-)?/, '')}
            </Text>
          ) : process.env.SANDBOX === 'sandbox-exec' ? (
            <Text color={Colors.AccentYellow}>
              MacOS Seatbelt{' '}
              <Text color={Colors.Gray}>({process.env.SEATBELT_PROFILE})</Text>
            </Text>
          ) : (
            <Text color={Colors.AccentRed}>
              no sandbox <Text color={Colors.Gray}>(see /docs)</Text>
            </Text>
          )}
        </Box>

        {/* Right Section: Gemini Label and Console Summary */}
        <Box alignItems="center">
          <Text color={Colors.AccentBlue}>
            {' '}
            {model}{' '}
            <Text color={Colors.Gray}>
              ({((1 - percentage) * 100).toFixed(0)}% context left)
              {consecutive429Count >= 0 && (
                <Text color={Colors.AccentRed}>
                  {' '}
                  | 429×{consecutive429Count}
                </Text>
              )}
            </Text>
          </Text>
          {corgiMode && (
            <Text>
              <Text color={Colors.Gray}>| </Text>
              <Text color={Colors.AccentRed}>▼</Text>
              <Text color={Colors.Foreground}>(´</Text>
              <Text color={Colors.AccentRed}>ᴥ</Text>
              <Text color={Colors.Foreground}>`)</Text>
              <Text color={Colors.AccentRed}>▼ </Text>
            </Text>
          )}
          {!showErrorDetails && errorCount > 0 && (
            <Box>
              <Text color={Colors.Gray}>| </Text>
              <ConsoleSummaryDisplay errorCount={errorCount} />
            </Box>
          )}
          {showMemoryUsage && <MemoryUsageDisplay />}
        </Box>
      </Box>

      {/* Request Status Line */}
      {currentRequest && (
        <Box flexDirection="column" marginTop={0}>
          <Box justifyContent="flex-start">
            <Text color={Colors.Gray}>
              {currentRequest.description}{' '}
              {currentRequest.status === 'active'
                ? `(${duration.toFixed(1)}s)`
                : currentRequest.status === 'completed'
                  ? `(${duration.toFixed(1)}s - completed)`
                  : `(${duration.toFixed(1)}s - error)`}
            </Text>
          </Box>
          {currentRequest.configDetails && (
            <Box justifyContent="flex-start" marginTop={0}>
              <Text color={Colors.Gray}>
                {currentRequest.configDetails.messageSnippet && (
                  <Text>
                    <Text color={Colors.AccentRed}>Prompt:</Text>
                    &quot;{currentRequest.configDetails.messageSnippet}
                    &quot;{' '}
                  </Text>
                )}
                {currentRequest.configDetails.toolsCount && (
                  <Text color={Colors.AccentBlue}>
                    tools:{currentRequest.configDetails.toolsCount}{' '}
                  </Text>
                )}
                {currentRequest.configDetails.temperature !== undefined && (
                  <Text color={Colors.AccentYellow}>
                    temp:{currentRequest.configDetails.temperature}{' '}
                  </Text>
                )}
                {currentRequest.configDetails.maxOutputTokens && (
                  <Text color={Colors.AccentGreen}>
                    max:{currentRequest.configDetails.maxOutputTokens}{' '}
                  </Text>
                )}
                {currentRequest.configDetails.systemInstructionSnippet && (
                  <Text color={Colors.LightBlue}>
                    sys:&quot;
                    {currentRequest.configDetails.systemInstructionSnippet}
                    &quot;
                  </Text>
                )}
              </Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};
