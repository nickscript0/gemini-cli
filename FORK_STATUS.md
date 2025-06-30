# Fork Status

This document tracks the changes made to this fork of the Gemini CLI project.

## Overview

This fork extends the original Gemini CLI with additional features and improvements focused on user experience and request visibility.

## Changes Made

### 1. Request Status Display Feature

**Status**: ✅ Complete (Enhanced with Counts)  
**Date**: June 30, 2025  
**Description**: Added real-time request status display in the CLI footer showing ongoing API requests with size, duration, detailed configuration information, and cumulative request type counts.

#### Files Added:

- `packages/cli/src/ui/contexts/RequestStatusContext.tsx` - React context for managing request status state

#### Files Modified:

- `packages/cli/src/ui/components/Footer.tsx` - Enhanced request status display with detailed config information
- `packages/cli/src/ui/contexts/RequestStatusContext.tsx` - Extended RequestStatus interface with configDetails
- `packages/cli/src/ui/App.tsx` - Integrated RequestStatusProvider
- `packages/core/src/config/config.ts` - Added RequestStatusHandler type and setRequestStatusHandler method
- `packages/core/src/core/geminiChat.ts` - Enhanced request tracking with config details extraction in sendMessage() and sendMessageStream()
- `packages/core/src/core/client.ts` - Added request tracking to generateJson() and generateContent()

#### Technical Details:

- **Display Format**:
  - Line 1: `\"[Type] request of size [X] ([duration]s)\"`
  - Line 2: `Prompt:\"[message snippet]\" tools:[N] temp:[X] max:[N] sys:\"[system snippet]\"`
- **Update Frequency**: 100ms timer for real-time duration updates
- **Request Types Tracked**: Prompt, JSON generation, Content generation (all with config details)
- **Size Calculation**: JSON.stringify() length of request payloads
- **Config Extraction**: Helper function extracts key parameters from GenerateContentConfig
- **Integration Pattern**: Uses same callback pattern as existing 429 rate limit tracking
- **Color Coding**: Different colors for different parameter types (Prompt=red, tools=blue, temp=yellow, max=green, sys=light blue)

#### Features:

- Real-time duration display during active requests
- Request size tracking for performance awareness
- **Request type counts display** showing cumulative counts for each request type (P:prompt, J:json, C:content) with color coding
- **Enhanced config details display including:**
  - **Message snippet** (first 50 characters of user input, trimmed of whitespace, with colored "Prompt:" prefix)
  - **Tools count** (number of tools available to the model)
  - **Temperature setting** (model creativity parameter)
  - **Max output tokens** (response length limit)
  - **System instruction snippet** (first 50 characters of system prompt, trimmed of whitespace)
- Automatic cleanup on request completion/error
- Non-intrusive display (new line below main footer)
- Type-specific request identification
- Concise, color-coded parameter display

---

## Next Steps

Potential future enhancements:

1. Response size tracking
2. Token usage display
3. Request history/statistics
4. Performance metrics
5. Error rate tracking

---

_Last Updated: June 30, 2025_

## Recent Enhancement (June 29, 2025)

**Enhanced Request Status Display**: The request status feature now shows detailed configuration parameters during active requests, providing better visibility into:

- User message content (truncated for readability)
- Model configuration (tools, temperature, token limits)
- System instructions (when present)

This enhancement helps users understand exactly what parameters are being sent to the Gemini API during each request, improving debugging and optimization workflows.

**JSON Generation Request Status Enhancement**: Extended the request status display to include configuration details for JSON generation requests, matching the functionality already available for prompt requests. This provides consistent visibility across all request types including:

- Message snippet display for JSON generation requests
- Configuration parameter visibility (tools, temperature, max tokens, system instructions)
- Consistent color-coded parameter display across all request types

## Latest Enhancement (June 30, 2025)

**Request Type Counts Display**: Added cumulative request tracking and display functionality to the footer. The system now tracks and displays the total number of requests made for each request type during the session:

- **Display Format**: `reqs: P:X J:Y C:Z` where X, Y, Z are the counts for Prompt, JSON, and Content requests respectively
- **Color Coding**: Prompt requests (red), JSON requests (blue), Content requests (green)
- **Location**: Moved to a separate line below the main footer for better readability
- **Reset Behavior**: Counts reset to 0 each time the user submits new input (presses enter), then accumulate during that user session
- **Conditional Display**: Only shows when at least one request has been made

#### Technical Implementation:

- Extended `RequestStatusContext` with `RequestTypeCounts` interface
- Added `requestCounts` state to track cumulative counts per request type
- Added `resetRequestCounts` function to reset all counts to 0 when user submits new input
- Modified `handleFinalSubmit` in App.tsx to call `resetRequestCounts` before processing new user input
- Updated Footer component to display counts with color-coded formatting on a separate line
- **Layout Enhancement (June 30, 2025)**: Moved request counts and 429 error counts to their own line below the main footer to reduce clutter and improve readability
- Maintains backward compatibility with existing request status functionality
