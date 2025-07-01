/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// DISCLAIMER: This is a copied version of https://github.com/googleapis/js-genai/blob/main/src/chats.ts with the intention of working around a key bug
// where function responses are not treated as "valid" responses: https://b.corp.google.com/issues/420354090

import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  GenerateContentResponse,
  Content,
  GenerateContentConfig,
  SendMessageParameters,
  createUserContent,
  Part,
  GenerateContentResponseUsageMetadata,
} from '@google/genai';
import { retryWithBackoff } from '../utils/retry.js';
import { isFunctionResponse } from '../utils/messageInspectors.js';
import { ContentGenerator, AuthType } from './contentGenerator.js';
import { Config } from '../config/config.js';
import {
  logApiRequest,
  logApiResponse,
  logApiError,
} from '../telemetry/loggers.js';
import {
  getStructuredResponse,
  getStructuredResponseFromParts,
} from '../utils/generateContentResponseUtilities.js';
import {
  ApiErrorEvent,
  ApiRequestEvent,
  ApiResponseEvent,
} from '../telemetry/types.js';
import { DEFAULT_GEMINI_FLASH_MODEL } from '../config/models.js';

/**
 * Extracts config details for request status display
 */
export function extractConfigDetails(
  config: GenerateContentConfig | undefined,
  message: unknown,
): {
  toolsCount?: number;
  systemInstructionSnippet?: string;
  messageSnippet?: string;
  temperature?: number;
  maxOutputTokens?: number;
} {
  const details: {
    toolsCount?: number;
    systemInstructionSnippet?: string;
    messageSnippet?: string;
    temperature?: number;
    maxOutputTokens?: number;
  } = {};

  if (config) {
    // Extract tools count
    if (config.tools) {
      details.toolsCount = Array.isArray(config.tools)
        ? config.tools.length
        : 1;
    }

    // Extract system instruction snippet (first 50 chars)
    if (config.systemInstruction) {
      let systemText = '';
      try {
        // Try to extract text from system instruction
        const instruction = config.systemInstruction;
        if (typeof instruction === 'string') {
          systemText = instruction;
        } else if (
          instruction &&
          typeof instruction === 'object' &&
          'parts' in instruction &&
          Array.isArray(instruction.parts)
        ) {
          systemText = instruction.parts
            .map((part: unknown) =>
              part &&
              typeof part === 'object' &&
              'text' in part &&
              typeof part.text === 'string'
                ? part.text
                : '',
            )
            .join(' ');
        }
      } catch (_e) {
        systemText = 'System instruction present';
      }
      details.systemInstructionSnippet =
        systemText.trim().length > 50
          ? systemText.trim().substring(0, 50) + '...'
          : systemText.trim();
    }

    // Extract temperature and maxOutputTokens
    if (config.temperature !== undefined) {
      details.temperature = config.temperature;
    }
    if (config.maxOutputTokens !== undefined) {
      details.maxOutputTokens = config.maxOutputTokens;
    }
  }

  // Extract message snippet (first 50 chars)
  let messageText = '';
  try {
    if (typeof message === 'string') {
      messageText = message;
    } else if (Array.isArray(message)) {
      messageText = message
        .map((part: unknown) =>
          part &&
          typeof part === 'object' &&
          'text' in part &&
          typeof part.text === 'string'
            ? part.text
            : '',
        )
        .join(' ');
    } else if (
      message &&
      typeof message === 'object' &&
      'text' in message &&
      typeof message.text === 'string'
    ) {
      messageText = message.text;
    }
  } catch (_e) {
    messageText = 'Message present';
  }
  details.messageSnippet =
    messageText.trim().length > 50
      ? messageText.trim().substring(0, 50) + '...'
      : messageText.trim();

  return details;
}

/**
 * Trims a string to 100 characters showing start and end.
 */
function trimPromptString(str: string): string {
  if (str.length <= 100) {
    return str;
  }
  const start = str.substring(0, 50);
  const end = str.substring(str.length - 50);
  return `${start}...${end}`;
}

/**
 * Logs the prompt to a file.
 */
async function logPromptToFile(prompt: string): Promise<void> {
  try {
    const logDir = path.join(os.homedir(), '.gemini');
    await fs.mkdir(logDir, { recursive: true });
    const logFile = path.join(logDir, 'prompt_log.txt');
    const timestamp = new Date().toISOString();
    const trimmedPrompt = trimPromptString(prompt);
    await fs.appendFile(
      logFile,
      `${timestamp}: PROMPT REQUEST: ${trimmedPrompt}\n`,
    );
  } catch (_error) {
    // Silently fail to avoid disrupting the user experience.
    // We can add more robust error handling here if needed.
  }
}

/**
 * Logs the response to a file.
 */
async function logResponseToFile(response: string): Promise<void> {
  try {
    const logDir = path.join(os.homedir(), '.gemini');
    await fs.mkdir(logDir, { recursive: true });
    const logFile = path.join(logDir, 'prompt_log.txt');
    const timestamp = new Date().toISOString();
    const trimmedResponse = trimPromptString(response);
    await fs.appendFile(
      logFile,
      `${timestamp}: PROMPT RESPONSE: ${trimmedResponse}\n`,
    );
  } catch (_error) {
    // Silently fail to avoid disrupting the user experience.
    // We can add more robust error handling here if needed.
  }
}

/**
 * Trims tool call arguments to show keys and value snippets.
 */
function trimToolCallArgs(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return trimPromptString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => trimToolCallArgs(item));
  }

  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = trimToolCallArgs(value);
    }
    return result;
  }

  return obj;
}

/**
 * Logs tool calls to a file.
 */
export async function logToolCallToFile(toolCallData: unknown): Promise<void> {
  try {
    const logDir = path.join(os.homedir(), '.gemini');
    await fs.mkdir(logDir, { recursive: true });
    const logFile = path.join(logDir, 'prompt_log.txt');
    const timestamp = new Date().toISOString();
    const trimmedToolCallData = trimToolCallArgs(toolCallData);
    const toolCallString = JSON.stringify(trimmedToolCallData);
    await fs.appendFile(
      logFile,
      `${timestamp}: TOOL_CALL: ${toolCallString}\n`,
    );
  } catch (_error) {
    // Silently fail to avoid disrupting the user experience.
    // We can add more robust error handling here if needed.
  }
}

/**
 * Returns true if the response is valid, false otherwise.
 */
function isValidResponse(response: GenerateContentResponse): boolean {
  if (response.candidates === undefined || response.candidates.length === 0) {
    return false;
  }
  const content = response.candidates[0]?.content;
  if (content === undefined) {
    return false;
  }
  return isValidContent(content);
}

function isValidContent(content: Content): boolean {
  if (content.parts === undefined || content.parts.length === 0) {
    return false;
  }
  for (const part of content.parts) {
    if (part === undefined || Object.keys(part).length === 0) {
      return false;
    }
    if (!part.thought && part.text !== undefined && part.text === '') {
      return false;
    }
  }
  return true;
}

/**
 * Validates the history contains the correct roles.
 *
 * @throws Error if the history does not start with a user turn.
 * @throws Error if the history contains an invalid role.
 */
function validateHistory(history: Content[]) {
  // Empty history is valid.
  if (history.length === 0) {
    return;
  }
  for (const content of history) {
    if (content.role !== 'user' && content.role !== 'model') {
      throw new Error(`Role must be user or model, but got ${content.role}.`);
    }
  }
}

/**
 * Extracts the curated (valid) history from a comprehensive history.
 *
 * @remarks
 * The model may sometimes generate invalid or empty contents(e.g., due to safety
 * filters or recitation). Extracting valid turns from the history
 * ensures that subsequent requests could be accepted by the model.
 */
function extractCuratedHistory(comprehensiveHistory: Content[]): Content[] {
  if (comprehensiveHistory === undefined || comprehensiveHistory.length === 0) {
    return [];
  }
  const curatedHistory: Content[] = [];
  const length = comprehensiveHistory.length;
  let i = 0;
  while (i < length) {
    if (comprehensiveHistory[i].role === 'user') {
      curatedHistory.push(comprehensiveHistory[i]);
      i++;
    } else {
      const modelOutput: Content[] = [];
      let isValid = true;
      while (i < length && comprehensiveHistory[i].role === 'model') {
        modelOutput.push(comprehensiveHistory[i]);
        if (isValid && !isValidContent(comprehensiveHistory[i])) {
          isValid = false;
        }
        i++;
      }
      if (isValid) {
        curatedHistory.push(...modelOutput);
      } else {
        // Remove the last user input when model content is invalid.
        curatedHistory.pop();
      }
    }
  }
  return curatedHistory;
}

/**
 * Chat session that enables sending messages to the model with previous
 * conversation context.
 *
 * @remarks
 * The session maintains all the turns between user and model.
 */
export class GeminiChat {
  // A promise to represent the current state of the message being sent to the
  // model.
  private sendPromise: Promise<void> = Promise.resolve();

  constructor(
    private readonly config: Config,
    private readonly contentGenerator: ContentGenerator,
    private readonly generationConfig: GenerateContentConfig = {},
    private history: Content[] = [],
  ) {
    validateHistory(history);
  }

  private _getRequestTextFromContents(contents: Content[]): string {
    return contents
      .flatMap((content) => content.parts ?? [])
      .map((part) => part.text)
      .filter(Boolean)
      .join('');
  }

  private async _logApiRequest(
    contents: Content[],
    model: string,
  ): Promise<void> {
    const requestText = this._getRequestTextFromContents(contents);
    logApiRequest(this.config, new ApiRequestEvent(model, requestText));
  }

  private async _logApiResponse(
    durationMs: number,
    usageMetadata?: GenerateContentResponseUsageMetadata,
    responseText?: string,
  ): Promise<void> {
    logApiResponse(
      this.config,
      new ApiResponseEvent(
        this.config.getModel(),
        durationMs,
        usageMetadata,
        responseText,
      ),
    );
  }

  private _logApiError(durationMs: number, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorType = error instanceof Error ? error.name : 'unknown';

    logApiError(
      this.config,
      new ApiErrorEvent(
        this.config.getModel(),
        errorMessage,
        durationMs,
        errorType,
      ),
    );
  }

  /**
   * Handles fallback to Flash model when persistent 429 errors occur for OAuth users.
   * Uses a fallback handler if provided by the config, otherwise returns null.
   */
  private async handleFlashFallback(authType?: string): Promise<string | null> {
    // Only handle fallback for OAuth users
    if (authType !== AuthType.LOGIN_WITH_GOOGLE_PERSONAL) {
      return null;
    }

    const currentModel = this.config.getModel();
    const fallbackModel = DEFAULT_GEMINI_FLASH_MODEL;

    // Don't fallback if already using Flash model
    if (currentModel === fallbackModel) {
      return null;
    }

    // Check if config has a fallback handler (set by CLI package)
    const fallbackHandler = this.config.flashFallbackHandler;
    if (typeof fallbackHandler === 'function') {
      const accepted = await fallbackHandler(currentModel, fallbackModel);
      if (accepted) {
        this.config.setModel(fallbackModel);
        return fallbackModel;
      }
    }

    return null;
  }

  /**
   * Sends a message to the model and returns the response.
   *
   * @remarks
   * This method will wait for the previous message to be processed before
   * sending the next message.
   *
   * @see {@link Chat#sendMessageStream} for streaming method.
   * @param params - parameters for sending messages within a chat session.
   * @returns The model's response.
   *
   * @example
   * ```ts
   * const chat = ai.chats.create({model: 'gemini-2.0-flash'});
   * const response = await chat.sendMessage({
   *   message: 'Why is the sky blue?'
   * });
   * console.log(response.text);
   * ```
   */
  async sendMessage(
    params: SendMessageParameters,
  ): Promise<GenerateContentResponse> {
    await this.sendPromise;
    const userContent = createUserContent(params.message);
    const requestContents = this.getHistory(true).concat(userContent);

    logPromptToFile(JSON.stringify(requestContents));

    this._logApiRequest(requestContents, this.config.getModel());

    // Track request status
    const requestId = `prompt-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const requestSize = JSON.stringify(params.message).length;
    const configDetails = extractConfigDetails(params.config, params.message);
    const requestInfo = {
      id: requestId,
      type: 'prompt' as const,
      description: `Prompt request of size ${requestSize}`,
      size: requestSize,
      configDetails,
    };

    this.config.requestStatusHandler?.('start', requestInfo);
    this.config.statusMessageHandler?.('Prompt Request');

    const startTime = Date.now();
    let response: GenerateContentResponse;

    try {
      const apiCall = () =>
        this.contentGenerator.generateContent({
          model: this.config.getModel() || DEFAULT_GEMINI_FLASH_MODEL,
          contents: requestContents,
          config: { ...this.generationConfig, ...params.config },
        });

      response = await retryWithBackoff(apiCall, {
        shouldRetry: (error: Error) => {
          if (error && error.message) {
            if (error.message.includes('429')) return true;
            if (error.message.match(/5\d{2}/)) return true;
          }
          return false;
        },
        onPersistent429: async (authType?: string) =>
          await this.handleFlashFallback(authType),
        authType: this.config.getContentGeneratorConfig()?.authType,
        on429CountChange: this.config.retry429CountHandler,
      });
      const durationMs = Date.now() - startTime;
      const responseText = getStructuredResponse(response);
      await this._logApiResponse(
        durationMs,
        response.usageMetadata,
        responseText,
      );

      logResponseToFile(responseText || '');
      this.config.statusMessageHandler?.('Received Prompt Response');

      this.sendPromise = (async () => {
        const outputContent = response.candidates?.[0]?.content;
        // Because the AFC input contains the entire curated chat history in
        // addition to the new user input, we need to truncate the AFC history
        // to deduplicate the existing chat history.
        const fullAutomaticFunctionCallingHistory =
          response.automaticFunctionCallingHistory;
        const index = this.getHistory(true).length;
        let automaticFunctionCallingHistory: Content[] = [];
        if (fullAutomaticFunctionCallingHistory != null) {
          automaticFunctionCallingHistory =
            fullAutomaticFunctionCallingHistory.slice(index) ?? [];
        }
        const modelOutput = outputContent ? [outputContent] : [];
        this.recordHistory(
          userContent,
          modelOutput,
          automaticFunctionCallingHistory,
        );
      })();
      await this.sendPromise.catch(() => {
        // Resets sendPromise to avoid subsequent calls failing
        this.sendPromise = Promise.resolve();
      });

      // Track request completion
      this.config.requestStatusHandler?.('end', requestInfo, 'completed');
      this.config.statusMessageHandler?.(null);

      return response;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this._logApiError(durationMs, error);
      this.sendPromise = Promise.resolve();
      throw error;
    }
  }

  /**
   * Sends a message to the model and returns the response in chunks.
   *
   * @remarks
   * This method will wait for the previous message to be processed before
   * sending the next message.
   *
   * @see {@link Chat#sendMessage} for non-streaming method.
   * @param params - parameters for sending the message.
   * @return The model's response.
   *
   * @example
   * ```ts
   * const chat = ai.chats.create({model: 'gemini-2.0-flash'});
   * const response = await chat.sendMessageStream({
   *   message: 'Why is the sky blue?'
   * });
   * for await (const chunk of response) {
   *   console.log(chunk.text);
   * }
   * ```
   */
  async sendMessageStream(
    params: SendMessageParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    await this.sendPromise;
    const userContent = createUserContent(params.message);
    const requestContents = this.getHistory(true).concat(userContent);
    logPromptToFile(JSON.stringify(requestContents));
    this._logApiRequest(requestContents, this.config.getModel());

    // Track request status
    const requestId = `prompt-stream-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const requestSize = JSON.stringify(params.message).length;
    const configDetails = extractConfigDetails(params.config, params.message);
    const requestInfo = {
      id: requestId,
      type: 'prompt' as const,
      description: `Prompt stream request of size ${requestSize}`,
      size: requestSize,
      configDetails,
    };

    this.config.requestStatusHandler?.('start', requestInfo);
    this.config.statusMessageHandler?.('Prompt Request');

    const startTime = Date.now();

    try {
      const apiCall = () =>
        this.contentGenerator.generateContentStream({
          model: this.config.getModel(),
          contents: requestContents,
          config: { ...this.generationConfig, ...params.config },
        });

      // Note: Retrying streams can be complex. If generateContentStream itself doesn't handle retries
      // for transient issues internally before yielding the async generator, this retry will re-initiate
      // the stream. For simple 429/500 errors on initial call, this is fine.
      // If errors occur mid-stream, this setup won't resume the stream; it will restart it.
      const streamResponse = await retryWithBackoff(apiCall, {
        shouldRetry: (error: Error) => {
          // Check error messages for status codes, or specific error names if known
          if (error && error.message) {
            if (error.message.includes('429')) return true;
            if (error.message.match(/5\d{2}/)) return true;
          }
          return false; // Don't retry other errors by default
        },
        onPersistent429: async (authType?: string) =>
          await this.handleFlashFallback(authType),
        authType: this.config.getContentGeneratorConfig()?.authType,
        on429CountChange: this.config.retry429CountHandler,
      });

      // Resolve the internal tracking of send completion promise - `sendPromise`
      // for both success and failure response. The actual failure is still
      // propagated by the `await streamResponse`.
      this.sendPromise = Promise.resolve(streamResponse)
        .then(() => undefined)
        .catch(() => undefined);

      const result = this.processStreamResponse(
        streamResponse,
        userContent,
        startTime,
      );

      // Track request completion
      this.config.requestStatusHandler?.('end', requestInfo, 'completed');
      this.config.statusMessageHandler?.(null);

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this._logApiError(durationMs, error);
      this.sendPromise = Promise.resolve();
      throw error;
    }
  }

  /**
   * Returns the chat history.
   *
   * @remarks
   * The history is a list of contents alternating between user and model.
   *
   * There are two types of history:
   * - The `curated history` contains only the valid turns between user and
   * model, which will be included in the subsequent requests sent to the model.
   * - The `comprehensive history` contains all turns, including invalid or
   *   empty model outputs, providing a complete record of the history.
   *
   * The history is updated after receiving the response from the model,
   * for streaming response, it means receiving the last chunk of the response.
   *
   * The `comprehensive history` is returned by default. To get the `curated
   * history`, set the `curated` parameter to `true`.
   *
   * @param curated - whether to return the curated history or the comprehensive
   *     history.
   * @return History contents alternating between user and model for the entire
   *     chat session.
   */
  getHistory(curated: boolean = false): Content[] {
    const history = curated
      ? extractCuratedHistory(this.history)
      : this.history;
    // Deep copy the history to avoid mutating the history outside of the
    // chat session.
    return structuredClone(history);
  }

  /**
   * Clears the chat history.
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Adds a new entry to the chat history.
   *
   * @param content - The content to add to the history.
   */
  addHistory(content: Content): void {
    this.history.push(content);
  }
  setHistory(history: Content[]): void {
    this.history = history;
  }

  getFinalUsageMetadata(
    chunks: GenerateContentResponse[],
  ): GenerateContentResponseUsageMetadata | undefined {
    const lastChunkWithMetadata = chunks
      .slice()
      .reverse()
      .find((chunk) => chunk.usageMetadata);

    return lastChunkWithMetadata?.usageMetadata;
  }

  private async *processStreamResponse(
    streamResponse: AsyncGenerator<GenerateContentResponse>,
    inputContent: Content,
    startTime: number,
  ) {
    const outputContent: Content[] = [];
    const chunks: GenerateContentResponse[] = [];

    try {
      for await (const chunk of streamResponse) {
        if (isValidResponse(chunk)) {
          chunks.push(chunk);
          const content = chunk.candidates?.[0]?.content;
          if (content !== undefined) {
            if (this.isThoughtContent(content)) {
              yield chunk;
              continue;
            }
            outputContent.push(content);
          }
        }
        yield chunk;
      }

      // Process response if no error occurred
      const durationMs = Date.now() - startTime;
      const allParts: Part[] = [];
      for (const content of outputContent) {
        if (content.parts) {
          allParts.push(...content.parts);
        }
      }
      const fullText = getStructuredResponseFromParts(allParts);
      await this._logApiResponse(
        durationMs,
        this.getFinalUsageMetadata(chunks),
        fullText,
      );

      logResponseToFile(fullText || '');
      this.config.statusMessageHandler?.('Received Prompt Response');
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this._logApiError(durationMs, error);
      this.sendPromise = Promise.resolve();
      this.config.statusMessageHandler?.(null);
      throw error;
    }
    this.recordHistory(inputContent, outputContent);
  }

  private recordHistory(
    userInput: Content,
    modelOutput: Content[],
    automaticFunctionCallingHistory?: Content[],
  ) {
    const nonThoughtModelOutput = modelOutput.filter(
      (content) => !this.isThoughtContent(content),
    );

    let outputContents: Content[] = [];
    if (
      nonThoughtModelOutput.length > 0 &&
      nonThoughtModelOutput.every((content) => content.role !== undefined)
    ) {
      outputContents = nonThoughtModelOutput;
    } else if (nonThoughtModelOutput.length === 0 && modelOutput.length > 0) {
      // This case handles when the model returns only a thought.
      // We don't want to add an empty model response in this case.
    } else {
      // When not a function response appends an empty content when model returns empty response, so that the
      // history is always alternating between user and model.
      // Workaround for: https://b.corp.google.com/issues/420354090
      if (!isFunctionResponse(userInput)) {
        outputContents.push({
          role: 'model',
          parts: [],
        } as Content);
      }
    }
    if (
      automaticFunctionCallingHistory &&
      automaticFunctionCallingHistory.length > 0
    ) {
      this.history.push(
        ...extractCuratedHistory(automaticFunctionCallingHistory!),
      );
    } else {
      this.history.push(userInput);
    }

    // Consolidate adjacent model roles in outputContents
    const consolidatedOutputContents: Content[] = [];
    for (const content of outputContents) {
      if (this.isThoughtContent(content)) {
        continue;
      }
      const lastContent =
        consolidatedOutputContents[consolidatedOutputContents.length - 1];
      if (this.isTextContent(lastContent) && this.isTextContent(content)) {
        // If both current and last are text, combine their text into the lastContent's first part
        // and append any other parts from the current content.
        lastContent.parts[0].text += content.parts[0].text || '';
        if (content.parts.length > 1) {
          lastContent.parts.push(...content.parts.slice(1));
        }
      } else {
        consolidatedOutputContents.push(content);
      }
    }

    if (consolidatedOutputContents.length > 0) {
      const lastHistoryEntry = this.history[this.history.length - 1];
      const canMergeWithLastHistory =
        !automaticFunctionCallingHistory ||
        automaticFunctionCallingHistory.length === 0;

      if (
        canMergeWithLastHistory &&
        this.isTextContent(lastHistoryEntry) &&
        this.isTextContent(consolidatedOutputContents[0])
      ) {
        // If both current and last are text, combine their text into the lastHistoryEntry's first part
        // and append any other parts from the current content.
        lastHistoryEntry.parts[0].text +=
          consolidatedOutputContents[0].parts[0].text || '';
        if (consolidatedOutputContents[0].parts.length > 1) {
          lastHistoryEntry.parts.push(
            ...consolidatedOutputContents[0].parts.slice(1),
          );
        }
        consolidatedOutputContents.shift(); // Remove the first element as it's merged
      }
      this.history.push(...consolidatedOutputContents);
    }
  }

  private isTextContent(
    content: Content | undefined,
  ): content is Content & { parts: [{ text: string }, ...Part[]] } {
    return !!(
      content &&
      content.role === 'model' &&
      content.parts &&
      content.parts.length > 0 &&
      typeof content.parts[0].text === 'string' &&
      content.parts[0].text !== ''
    );
  }

  private isThoughtContent(
    content: Content | undefined,
  ): content is Content & { parts: [{ thought: boolean }, ...Part[]] } {
    return !!(
      content &&
      content.role === 'model' &&
      content.parts &&
      content.parts.length > 0 &&
      typeof content.parts[0].thought === 'boolean' &&
      content.parts[0].thought === true
    );
  }
}
