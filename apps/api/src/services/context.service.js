const DEFAULT_CONTEXT = Object.freeze({
  old_input: null,
  old_rewrite_query: null,
  active_location_id: null,
  active_location_name: null,
  last_returned_images: [],
  last_suggested_locations: [],
  last_image_place_id: null,
  last_text_place_id: null,
  last_conflict: null,
  pending_question: null,
});

class ContextService {
  constructor() {
    this.sessions = new Map();
  }

  getContext(sessionId) {
    const key = this.getSessionKey(sessionId);

    if (!this.sessions.has(key)) {
      this.sessions.set(key, { ...DEFAULT_CONTEXT });
    }

    return this.cloneContext(this.sessions.get(key));
  }

  updateOnSuccess(sessionId, updates = {}) {
    const key = this.getSessionKey(sessionId);
    const current = this.getContext(key);
    const next = {
      ...current,
      old_input: updates.old_input ?? current.old_input,
      old_rewrite_query: updates.old_rewrite_query ?? current.old_rewrite_query,
      active_location_id: updates.active_location_id ?? current.active_location_id,
      active_location_name: updates.active_location_name ?? current.active_location_name,
      last_returned_images: updates.last_returned_images ?? current.last_returned_images,
      last_suggested_locations:
        updates.last_suggested_locations ?? current.last_suggested_locations,
      last_image_place_id: updates.last_image_place_id ?? current.last_image_place_id,
      last_text_place_id: updates.last_text_place_id ?? current.last_text_place_id,
      last_conflict: updates.last_conflict ?? null,
      pending_question: null,
    };

    this.sessions.set(key, next);
    return this.cloneContext(next);
  }

  setPendingQuestion(sessionId, pendingQuestion) {
    const key = this.getSessionKey(sessionId);
    const current = this.getContext(key);
    const next = {
      ...current,
      pending_question: pendingQuestion,
    };

    this.sessions.set(key, next);
    return this.cloneContext(next);
  }

  clear(sessionId) {
    this.sessions.delete(this.getSessionKey(sessionId));
  }

  getSessionKey(sessionId) {
    return sessionId || "anonymous";
  }

  cloneContext(context) {
    return {
      ...context,
      last_returned_images: [...(context.last_returned_images || [])],
      last_suggested_locations: [...(context.last_suggested_locations || [])],
    };
  }
}

const contextService = new ContextService();

module.exports = {
  ContextService,
  DEFAULT_CONTEXT,
  contextService,
};
