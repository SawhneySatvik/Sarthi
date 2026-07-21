/** Framework-clean contracts shared by core use cases and adapter implementations. */
export type {
  ImageInput,
  LlmGateway,
  LlmProviderName,
  ObjectRequest,
  ObjectResult,
  TextRequest,
  Tier,
  Transcription,
  VisionProvider,
  VisionProviderName,
  VoiceAudio,
  VoiceProvider,
  MediaProvider,
  VoiceProviderName,
} from "./providers";

export type {
  AuthenticatedUser,
  ScopedEntityRepository,
  AppendOnlyRepository,
  ProfileRepository,
  MoneyRepositories,
  HealthRepositories,
  HabitRepositories,
  SkillRepositories,
  PlanRepositories,
  CoachRepositories,
  CoachMemoryRepository,
  EvidenceRepository,
  JourneyRepositories,
  CommitRepository,
  BillingRepository,
  AdminWaitlistRepository,
  UserScopedRepositories,
  RepositoryFactory,
} from "./repositories";

export type { AuthProvider } from "./auth";

// Error classes are runtime values, not types — re-export without `type` under isolatedModules.
export { SarthiError, ProviderConfigurationError, RepositoryError } from "./errors";
