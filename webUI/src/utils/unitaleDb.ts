/**
 * @fileoverview Unitale IndexedDB 存储工具
 * @description 封装工程状态与媒体素材的浏览器本地持久化
 * - 数据库连接：复用 IndexedDB 连接并处理关闭重连
 * - 素材仓库：保存、读取、删除音频和图片 Blob
 * - 工程仓库：保存和读取当前工程 JSON 状态
 * @module src/utils/unitaleDb
 */

/** 批量保存素材项。 */
export interface AssetBatchItem {
  /** IndexedDB 素材键。 */
  key: string
  /** 待保存素材。 */
  blob: Blob | File
}

const DB_NAME = 'UnitaleDB'
const DB_VERSION = 1
let dbInstance: IDBDatabase | null = null
let dbPromise: Promise<IDBDatabase> | null = null

/**
 * 初始化 IndexedDB 连接并确保对象仓库存在。
 * @returns {Promise<IDBDatabase>} IndexedDB 数据库实例。
 */
export const initUnitaleDB = (): Promise<IDBDatabase> => {
  if (dbInstance) return Promise.resolve(dbInstance)
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = (event) => {
      console.error('DB Error', event)
      dbPromise = null
      reject(event)
    }

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result
      dbInstance.onclose = () => {
        dbInstance = null
        dbPromise = null
      }
      dbInstance.onversionchange = () => {
        dbInstance?.close()
        dbInstance = null
        dbPromise = null
      }
      resolve(dbInstance)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains('project')) db.createObjectStore('project')
      if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets')
    }
  })

  return dbPromise
}

/**
 * 获取有效数据库连接。
 * @returns {Promise<IDBDatabase>} IndexedDB 数据库实例。
 */
const getDB = async (): Promise<IDBDatabase> => {
  if (!dbInstance) return initUnitaleDB()
  return dbInstance
}

/**
 * 重置连接并重新初始化。
 * @returns {Promise<IDBDatabase>} 新连接。
 */
const reconnectDB = async (): Promise<IDBDatabase> => {
  dbInstance = null
  dbPromise = null
  return initUnitaleDB()
}

/**
 * 将单个媒体资源写入 IndexedDB。
 * @param {string} key - 资源键名。
 * @param {Blob | File} blob - 待保存的二进制资源。
 * @returns {Promise<void>} 保存完成后返回。
 */
export const saveAssetToDB = async (key: string, blob: Blob | File): Promise<void> => {
  try {
    const db = await getDB()
    return await new Promise((resolve, reject) => {
      try {
        const tx = db.transaction('assets', 'readwrite')
        tx.objectStore('assets').put(blob, key)
        tx.oncomplete = () => resolve()
        tx.onerror = (event) => reject(event)
      } catch (error) {
        reject(error)
      }
    })
  } catch (error) {
    const err = error as Error & { name?: string }
    if (err.name === 'InvalidStateError' || (err.message && err.message.includes('closing'))) {
      console.warn('DB connection closed, retrying saveAssetToDB...')
      const db = await reconnectDB()
      return new Promise((resolve, reject) => {
        const tx = db.transaction('assets', 'readwrite')
        tx.objectStore('assets').put(blob, key)
        tx.oncomplete = () => resolve()
        tx.onerror = (event) => reject(event)
      })
    }
    throw error
  }
}

/**
 * 从 IndexedDB 读取单个媒体资源。
 * @param {string} key - 资源键名。
 * @returns {Promise<Blob | File | null>} 读取到的资源或空值。
 */
export const loadAssetFromDB = async (key: string): Promise<Blob | File | null> => {
  const db = await getDB()
  return new Promise((resolve) => {
    const tx = db.transaction('assets', 'readonly')
    const req = tx.objectStore('assets').get(key)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => resolve(null)
  })
}

/**
 * 从 IndexedDB 删除单个媒体资源。
 * @param {string} key - 资源键名。
 * @returns {Promise<void>} 删除完成后返回。
 */
export const deleteAssetFromDB = async (key: string): Promise<void> => {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('assets', 'readwrite')
    const req = tx.objectStore('assets').delete(key)
    req.onsuccess = () => resolve()
    req.onerror = (event) => reject((event.target as IDBRequest).error)
  })
}

/**
 * 批量写入媒体资源，并通过分块与重试降低大事务失败概率。
 * @param {AssetBatchItem[]} items - 待写入资源列表。
 * @returns {Promise<void>} 全部资源写入完成。
 */
export const saveAssetsBatch = async (items: AssetBatchItem[]): Promise<void> => {
  await getDB()

  const uniqueMap = new Map<string, Blob | File>()
  items.forEach((item) => uniqueMap.set(item.key, item.blob))
  const entries = Array.from(uniqueMap.entries())
  const batchSize = 5

  for (let index = 0; index < entries.length; index += batchSize) {
    const chunk = entries.slice(index, index + batchSize)
    let retries = 3

    while (retries > 0) {
      try {
        const db = await getDB()
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('assets', 'readwrite')
          const store = tx.objectStore('assets')
          tx.oncomplete = () => resolve()
          tx.onerror = (event) => reject(event)
          tx.onabort = (event) => reject(event)

          for (const [key, blob] of chunk) {
            store.put(blob, key)
          }
        })
        break
      } catch (error) {
        console.warn(`Batch save failed (chunk ${index}), retrying...`, error)
        retries -= 1
        if (retries === 0) throw error
        await reconnectDB()
      }
    }
  }
}

/**
 * 保存当前工程 JSON 状态。
 * @param {unknown} projectData - 可结构化克隆的工程数据。
 * @returns {Promise<void>} 保存完成后返回。
 */
export const saveProjectDataToDB = async (projectData: unknown): Promise<void> => {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('project', 'readwrite')
    tx.objectStore('project').put(projectData, 'currentState')
    tx.oncomplete = () => resolve()
    tx.onerror = (event) => reject(event)
  })
}

/**
 * 读取当前工程 JSON 状态。
 * @template T 工程数据类型。
 * @returns {Promise<T | null>} 当前工程数据或空值。
 */
export const loadProjectDataFromDB = async <T = any>(): Promise<T | null> => {
  const db = await getDB()
  return new Promise((resolve) => {
    const tx = db.transaction('project', 'readonly')
    const req = tx.objectStore('project').get('currentState')
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => resolve(null)
  })
}
