/**
 * A minimal stand-in for the chainable object `supabase.from(...)`
 * returns. Every non-terminal method (select/eq/insert/update/...)
 * returns the same object so calls can be chained in any order, the
 * way the real supabase-js query builder works. Two ways to resolve:
 *  - call `.single()` / `.maybeSingle()` explicitly, or
 *  - `await` the builder directly (list queries with no `.single()`),
 *    which the `.then` implementation below supports.
 */
export interface QueryResult<T = unknown> {
  data: T;
  error: { message: string } | null;
  count?: number;
}

export function makeQuery<T>(result: QueryResult<T>) {
  const query: any = {};
  const chain = () => query;

  query.select = jest.fn(chain);
  query.eq = jest.fn(chain);
  query.insert = jest.fn(chain);
  query.update = jest.fn(chain);
  query.upsert = jest.fn(chain);
  query.delete = jest.fn(chain);
  query.order = jest.fn(chain);
  query.limit = jest.fn(chain);
  query.range = jest.fn(chain);
  query.or = jest.fn(chain);
  query.is = jest.fn(chain);
  query.textSearch = jest.fn(chain);
  query.single = jest.fn(() => Promise.resolve(result));
  query.maybeSingle = jest.fn(() => Promise.resolve(result));
  query.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);

  return query;
}

export function makeSupabaseMock() {
  return {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(),
    storage: {
      from: jest.fn(),
    },
  };
}
