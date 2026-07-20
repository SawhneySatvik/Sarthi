/**
 * data/repository — barrel for the repository composition roots.
 *
 * Business logic depends on the `RepositoryFactory` port from `@/core/contracts`;
 * these factories are its Drizzle/SQLite implementation.
 */
export {
  assembleUserScopedRepositories,
  createRepositoryFactory,
  createSqliteRepositoryFactory,
  createPostgresRepositoryFactory,
} from "./factory";
