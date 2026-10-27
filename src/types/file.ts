/** 文件上传返回的文件记录（POST /files/upload/multiple，挂在 VITE_API_BASE_KEY 前缀下） */
export interface UploadedFile {
  /** 文件记录 id，即业务接口所需的 fileId */
  _id: string
  originalName: string
  storedName: string
  path: string
  size: number
  mimeType: string
  ext: string
}
