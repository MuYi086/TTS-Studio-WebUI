import { ASSET_STORE, openUnitaleDb } from './db';

export interface AssetBatchItem {
  key: string;
  blob: Blob;
}

const BATCH_SIZE = 5;

export class AssetRepository {
  async saveAsset(key: string, blob: Blob): Promise<void> {
    const database = await openUnitaleDb();

    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(ASSET_STORE, 'readwrite');
      tx.objectStore(ASSET_STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = (event) => reject(event);
      tx.onabort = (event) => reject(event);
    });
  }

  async loadAsset(key: string): Promise<Blob | null> {
    const database = await openUnitaleDb();

    return new Promise<Blob | null>((resolve) => {
      const tx = database.transaction(ASSET_STORE, 'readonly');
      const request = tx.objectStore(ASSET_STORE).get(key);
      request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
      request.onerror = () => resolve(null);
    });
  }

  async deleteAsset(key: string): Promise<void> {
    const database = await openUnitaleDb();

    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(ASSET_STORE, 'readwrite');
      tx.objectStore(ASSET_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = (event) => reject(event);
      tx.onabort = (event) => reject(event);
    });
  }

  async saveAssetsBatch(items: AssetBatchItem[]): Promise<void> {
    const database = await openUnitaleDb();
    const uniqueEntries = Array.from(new Map(items.map((item) => [item.key, item.blob])).entries());

    for (let index = 0; index < uniqueEntries.length; index += BATCH_SIZE) {
      const chunk = uniqueEntries.slice(index, index + BATCH_SIZE);

      await new Promise<void>((resolve, reject) => {
        const tx = database.transaction(ASSET_STORE, 'readwrite');
        const store = tx.objectStore(ASSET_STORE);

        chunk.forEach(([key, blob]) => {
          store.put(blob, key);
        });

        tx.oncomplete = () => resolve();
        tx.onerror = (event) => reject(event);
        tx.onabort = (event) => reject(event);
      });
    }
  }
}
