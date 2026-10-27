/** GET /system/resources 返回的系统资源总览 */
export interface SystemResources {
  cpu: CpuUsage
  memory: MemoryUsage
  disk: DiskInfo[]
  gpu: GpuInfo[]
  process: ProcessInfo
}

export interface GpuInfo {
  name: string
  utilizationPercent: number
  temperature: number
  memory: GpuMemory
}

export interface GpuMemory {
  total: number
  used: number
  percent: number
}
export interface SystemVersion {
  local_version: string
  remote_version: string
}

export interface CpuUsage {
  usagePercent: number
}

export interface MemoryUsage {
  total: number
  used: number
  free: number
  percent: number
}

export interface DiskInfo {
  name: string
  mount: string
  fsType: string
  total: number
  used: number
  free: number
  usagePercent: number
}

export interface ProcessInfo {
  platform: string
  memory: ProcessMemory
}

export interface ProcessMemory {
  rss: number
  heapTotal: number
  heapUsed: number
  external: number
}
