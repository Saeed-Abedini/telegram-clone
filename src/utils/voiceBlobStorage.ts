export const voiceBlobStorage = {
  async saveBlob(id: string, blob: Blob): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('voiceMessagesDB', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction('voiceBlobs', 'readwrite');
        const store = transaction.objectStore('voiceBlobs');
        store.put({ id, blob });
        transaction.oncomplete = () => resolve();
        transaction.onerror = (e) => reject(e);
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('voiceBlobs')) {
          db.createObjectStore('voiceBlobs', { keyPath: 'id' });
        }
      };
    });
  },
  
  async getBlob(id: string): Promise<Blob | null> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('voiceMessagesDB', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction('voiceBlobs', 'readonly');
        const store = transaction.objectStore('voiceBlobs');
        const getRequest = store.get(id);
        
        getRequest.onsuccess = () => {
          resolve(getRequest.result?.blob || null);
        };
        getRequest.onerror = () => reject(getRequest.error);
      };
    });
  },
  
  async deleteBlob(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('voiceMessagesDB', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction('voiceBlobs', 'readwrite');
        const store = transaction.objectStore('voiceBlobs');
        store.delete(id);
        transaction.oncomplete = () => resolve();
        transaction.onerror = (e) => reject(e);
      };
    });
  }
};