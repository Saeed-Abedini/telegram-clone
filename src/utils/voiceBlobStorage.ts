// Initialize the database and ensure object store exists
async function initializeDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("voiceMessagesDB", 1);

    request.onerror = () => {
      console.error("Failed to open IndexedDB:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains("voiceBlobs")) {
        db.createObjectStore("voiceBlobs", { keyPath: "id" });
      }
    };
  });
}

export const voiceBlobStorage = {
  async saveBlob(id: string, blob: Blob): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await initializeDB();
        const transaction = db.transaction("voiceBlobs", "readwrite");
        const store = transaction.objectStore("voiceBlobs");

        // Create a proper object structure for storage
        const blobData = {
          id: id,
          blob: blob,
          timestamp: Date.now(),
          size: blob.size,
          type: blob.type,
        };

        const request = store.put(blobData);

        request.onsuccess = () => {
          console.log("Blob save request successful:", id);
        };

        request.onerror = (e) => {
          console.error("Error in put request:", e);
          reject(e);
        };

        transaction.oncomplete = () => {
          db.close();
          console.log("Blob saved successfully:", id);
          resolve();
        };

        transaction.onerror = (e) => {
          console.error("Transaction error saving blob:", e);
          db.close();
          reject(e);
        };

        transaction.onabort = () => {
          console.error("Transaction aborted saving blob");
          db.close();
          reject(new Error("Transaction aborted"));
        };
      } catch (error) {
        console.error("Error in saveBlob:", error);
        reject(error);
      }
    });
  },

  async getBlob(id: string): Promise<Blob | null> {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await initializeDB();
        const transaction = db.transaction("voiceBlobs", "readonly");
        const store = transaction.objectStore("voiceBlobs");
        const getRequest = store.get(id);

        getRequest.onsuccess = () => {
          const result = getRequest.result;

          if (result && result.blob) {
            db.close();
            resolve(result.blob);
          } else {
            db.close();
            resolve(null);
          }
        };

        getRequest.onerror = () => {
          console.error("Error getting blob:", getRequest.error);
          db.close();
          reject(getRequest.error);
        };

        transaction.onerror = () => {
          console.error("Transaction error getting blob");
          db.close();
          reject(new Error("Transaction error"));
        };
      } catch (error) {
        console.error("Error in getBlob:", error);
        reject(error);
      }
    });
  },

  async deleteBlob(id: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await initializeDB();
        const transaction = db.transaction("voiceBlobs", "readwrite");
        const store = transaction.objectStore("voiceBlobs");
        
        // فقط همون آیدی خاص رو پاک کن
        const deleteRequest = store.delete(id);

        deleteRequest.onsuccess = () => {
          console.log("Blob deleted successfully:", id);
        };

        deleteRequest.onerror = () => {
          console.error("Error deleting blob:", deleteRequest.error);
        };

        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onerror = (e) => {
          db.close();
          console.error("Transaction error deleting blob:", e);
          reject(e);
        };
      } catch (error) {
        console.error("Error in deleteBlob:", error);
        reject(error);
      }
    });
  },

  // Debug function to check database status
  async debugDatabase(): Promise<void> {
    try {
      const db = await initializeDB();
      // Check if we can read all keys
      const transaction = db.transaction("voiceBlobs", "readonly");
      const store = transaction.objectStore("voiceBlobs");
      const getAllKeys = store.getAllKeys();

      getAllKeys.onsuccess = () => {
        db.close();
      };

      getAllKeys.onerror = () => {
        console.error("Error getting all keys:", getAllKeys.error);
        db.close();
      };
    } catch (error) {
      console.error("Debug database error:", error);
    }
  },
};
