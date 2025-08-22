import Message from "@/models/message";

export interface PendingMessage extends Message {
  retryCount: number;
  lastAttempt: number;
  tempId: string;
}

const PENDING_MESSAGES_KEY = "telegram_pending_messages";

export const pendingMessagesService = {
  // Stored pending messages in localStorage
  savePendingMessages: (roomId: string, messages: PendingMessage[]) => {
    try {
      const existing = pendingMessagesService.getAllPendingMessages();
      existing[roomId] = messages;
      localStorage.setItem(PENDING_MESSAGES_KEY, JSON.stringify(existing));
    } catch (error) {
      console.error("Error saving pending messages:", error);
    }
  },

  // Receive pending messages for a specific room
  getPendingMessages: (roomId: string): PendingMessage[] => {
    try {
      const allMessages = pendingMessagesService.getAllPendingMessages();
      return allMessages[roomId] || [];
    } catch (error) {
      console.error("Error getting pending messages:", error);
      return [];
    }
  },

  // Get all pending messages
  getAllPendingMessages: (): Record<string, PendingMessage[]> => {
    try {
      const stored = localStorage.getItem(PENDING_MESSAGES_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error("Error parsing pending messages:", error);
      return {};
    }
  },

  // Delete pending message
  removePendingMessage: (roomId: string, tempId: string) => {
    try {
      const existing = pendingMessagesService.getAllPendingMessages();
      if (existing[roomId]) {
        existing[roomId] = existing[roomId].filter(
          (msg) => msg.tempId !== tempId
        );
        if (existing[roomId].length === 0) {
          delete existing[roomId];
        }
        localStorage.setItem(PENDING_MESSAGES_KEY, JSON.stringify(existing));
      }
    } catch (error) {
      console.error("Error removing pending message:", error);
    }
  },

  // Add a new message to pending
  addPendingMessage: (
    roomId: string,
    message: Omit<PendingMessage, "retryCount" | "lastAttempt">
  ) => {
    const pendingMessage: PendingMessage = {
      ...message,
      retryCount: 0,
      lastAttempt: Date.now(),
    };

    const existing = pendingMessagesService.getPendingMessages(roomId);
    existing.push(pendingMessage);
    pendingMessagesService.savePendingMessages(roomId, existing);
    return pendingMessage;
  },

  // Clear all pending messages for a room
  clearPendingMessages: (roomId: string) => {
    const existing = pendingMessagesService.getAllPendingMessages();
    delete existing[roomId];
    localStorage.setItem(PENDING_MESSAGES_KEY, JSON.stringify(existing));
  },

  // Cancel a pending or failed message and delete it from local storage
  cancelPendingMessage: (roomId: string, tempId: string) => {
    try {
      const existing = pendingMessagesService.getAllPendingMessages();
      if (existing[roomId]) {
        existing[roomId] = existing[roomId].filter(
          (msg) => msg.tempId !== tempId
        );
        if (existing[roomId].length === 0) {
          delete existing[roomId];
        }
        localStorage.setItem(PENDING_MESSAGES_KEY, JSON.stringify(existing));
      }
    } catch (error) {
      console.error("Error canceling pending message:", error);
    }
  },
};
