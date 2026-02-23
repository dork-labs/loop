import { timestamp, text } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

export const softDelete = {
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
};

export const cuid2Id = {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
};
