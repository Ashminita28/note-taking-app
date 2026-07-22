-- Migration: Add search vector column and trigger
ALTER TABLE "Note" ADD COLUMN "searchVector" tsvector;

CREATE INDEX idx_note_search_vector ON "Note" USING GIN("searchVector");

CREATE OR REPLACE FUNCTION note_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', COALESCE(NEW."title", '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW."contentPlain", '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER note_search_vector_trigger
  BEFORE INSERT OR UPDATE OF "title", "contentPlain"
  ON "Note"
  FOR EACH ROW
  EXECUTE FUNCTION note_search_vector_update();
