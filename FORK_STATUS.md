# Fork Status

This document tracks the changes made to this fork of the Gemini CLI project.

## Overview

This fork extends the original Gemini CLI with additional features and improvements focused on user experience and request visibility.

## Changes Made

### 1. Request Status Display Feature

**Status**: ✅ Complete  
**Date**: June 29, 2025  
**Description**: Added real-time request status display in the CLI footer showing ongoing API requests with size and duration information.

#### Files Added:

- `packages/cli/src/ui/contexts/RequestStatusContext.tsx` - React context for managing request status state

#### Files Modified:

- `packages/cli/src/ui/components/Footer.tsx` - Added request status display below existing footer content
- `packages/cli/src/ui/App.tsx` - Integrated RequestStatusProvider
- `packages/core/src/config/config.ts` - Added RequestStatusHandler type and setRequestStatusHandler method
- `packages/core/src/core/geminiChat.ts` - Added request tracking to sendMessage() and sendMessageStream()
- `packages/core/src/core/client.ts` - Added request tracking to generateJson() and generateContent()

#### Technical Details:

- **Display Format**: `"[Type] request of size [X] ([duration]s)"`
- **Update Frequency**: 100ms timer for real-time duration updates
- **Request Types Tracked**: Prompt, JSON generation, Content generation
- **Size Calculation**: JSON.stringify() length of request payloads
- **Integration Pattern**: Uses same callback pattern as existing 429 rate limit tracking

#### Features:

- Real-time duration display during active requests
- Request size tracking for performance awareness
- Automatic cleanup on request completion/error
- Non-intrusive display (new line below main footer)
- Type-specific request identification

---

## Next Steps

Potential future enhancements:

1. Response size tracking
2. Token usage display
3. Request history/statistics
4. Performance metrics
5. Error rate tracking

---

_Last Updated: June 29, 2025_
