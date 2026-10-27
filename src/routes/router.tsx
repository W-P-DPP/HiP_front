import { Navigate, createHashRouter } from 'react-router-dom'

import { AdminLayout } from '@/layouts/AdminLayout'
import { RequireAuth } from '@/routes/RequireAuth'
import { ApiKeysPage } from '@/pages/ApiKeysPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { NarrationVideoRecordPage } from '@/pages/NarrationVideoRecordPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { SceneSplitRecordPage } from '@/pages/SceneSplitRecordPage'
import { SubtitleRecordPage } from '@/pages/SubtitleRecordPage'
import { SynthesisRecordPage } from '@/pages/SynthesisRecordPage'
import { UsersPage } from '@/pages/UsersPage'
import { MaterialLibraryPage } from '@/pages/material/MaterialLibraryPage'
import { VoiceTrainingCreatePage } from '@/pages/voiceTrain/VoiceTrainingCreatePage'
import { VoiceTrainingPage } from '@/pages/voiceTrain/VoiceTrainingPage'
import { VoiceTrainV2Page } from '@/pages/voiceTrainV2/VoiceTrainV2Page'
import { ExecRecord } from '@/pages/execRecord/execRecordPage'
import { DataAnalyze } from '@/pages/dataAnalyze/dataAnalyzePage'
import { DigitalHuman } from '@/pages/digitalHuman/DigitalHuman.tsx'
import { DigitalHumanSynthesisRecordPage } from '@/pages/digitalHuman/DigitalHumanSynthesisRecordPage'
import { WorkRoomPage } from '@/pages/workRoom/WorkRoomPage'
import { ChatPage } from '@/pages/workRoom/ChatPage'
import { DigitalHumanFactoryPage } from '@/pages/workRoom/DigitalHumanFactoryPage'
import { ShortVideoFactoryPage } from '@/pages/workRoom/ShortVideoFactoryPage'
import { SubtitleSynthesisPage } from '@/pages/workRoom/SubtitleSynthesisPage'
import { ImageUnderstandingPage } from '@/pages/workRoom/ImageUnderstandingPage'
import { SceneProcessPage } from '@/pages/workRoom/SceneProcessPage'
export const router = createHashRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'users', element: <UsersPage /> },
          { path: 'voice-training', element: <VoiceTrainingPage /> },
          { path: 'voice-training/create', element: <VoiceTrainingCreatePage /> },
          { path: 'voice-training-v2', element: <VoiceTrainV2Page /> },
          { path: 'materials', element: <MaterialLibraryPage /> },
          { path: 'account/api-keys', element: <ApiKeysPage /> },
          { path: 'account/synthesis-records', element: <SynthesisRecordPage /> },
          { path: 'account/subtitle-records', element: <SubtitleRecordPage /> },
          { path: 'account/digital-human-records', element: <DigitalHumanSynthesisRecordPage /> },
          { path: 'account/scene-split-records', element: <SceneSplitRecordPage /> },
          { path: 'account/narration-video-records', element: <NarrationVideoRecordPage /> },
          { path: 'account/profile', element: <ProfilePage /> },
          { path: 'exec-record', element: <ExecRecord /> },
          { path: 'data-analyze', element: <DataAnalyze /> },
          { path: 'digital-human', element: <DigitalHuman /> },
          { path: 'work-room', element: <WorkRoomPage /> },
          { path: 'work-room/chat', element: <ChatPage /> },
          { path: 'work-room/digital-human', element: <DigitalHumanFactoryPage /> },
          { path: 'work-room/short-video', element: <ShortVideoFactoryPage /> },
          { path: 'work-room/subtitle', element: <SubtitleSynthesisPage /> },
          { path: 'work-room/image-understand', element: <ImageUnderstandingPage /> },
          { path: 'work-room/scene-split', element: <SceneProcessPage /> },
        ],
      },
    ],
  },
])
