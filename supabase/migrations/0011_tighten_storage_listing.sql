-- Planto – stram inn offentlig listing av plantebilder.
-- Den brede SELECT-policyen på storage.objects («plant photos are publicly
-- readable») lot hvem som helst LISTE alle filnavn i bøtta, på tvers av
-- husstander. Offentlige bøtter serverer objekt-URL-er uten denne policyen, og
-- appen lister aldri filer (den bruker getPublicUrl + lagret photo_url). Vi
-- fjerner derfor policyen. <img>-visning og opplasting påvirkes ikke; opplasting,
-- oppdatering og sletting styres fortsatt av de husstands-scopede policyene.

drop policy if exists "plant photos are publicly readable" on storage.objects;
