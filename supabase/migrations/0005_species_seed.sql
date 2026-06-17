-- Planto – forhåndsfyll arts-registeret med vanlige norske stueplanter.
-- Trygt å kjøre flere ganger (ON CONFLICT DO NOTHING). Stellverdiene er
-- veiledende standardverdier som kan justeres per plante.
--
-- Kjør i Supabase SQL Editor etter 0004_species.sql.

insert into public.species
  (latin_name, common_name, light_needs, water_interval_days, fertilize_interval_days, repot_interval_months, toxic_to_pets, notes)
values
  ('Monstera deliciosa', 'Vindusblad', 'Lyst, indirekte lys', 7, 30, 24, true, 'La de øverste cm tørke mellom vanning. Liker å klatre.'),
  ('Epipremnum aureum', 'Gullranke', 'Halvskygge til lyst', 7, 30, 24, true, 'Svært hardfør hengeplante. Tåler litt tørke.'),
  ('Dracaena trifasciata', 'Svigermors tunge', 'Tåler det meste, også skygge', 14, 60, 36, true, 'Vann sjelden – svært tørketolerant.'),
  ('Zamioculcas zamiifolia', 'ZZ-plante', 'Halvskygge til lyst', 14, 60, 36, true, 'Lagrer vann i rhizomer. Vann lite, særlig om vinteren.'),
  ('Ficus lyrata', 'Fiolinfiken', 'Mye indirekte lys', 7, 30, 24, true, 'Liker fast plassering uten trekk.'),
  ('Ficus elastica', 'Gummifiken', 'Lyst, indirekte', 7, 30, 24, true, 'Tørk av bladene for glans og lys.'),
  ('Ficus benjamina', 'Bjørkefiken', 'Lyst', 7, 30, 24, true, 'Kan felle blader ved flytting eller trekk.'),
  ('Spathiphyllum wallisii', 'Fredslilje', 'Halvskygge', 5, 30, 24, true, 'Henger med bladene når den er tørst.'),
  ('Chlorophytum comosum', 'Grønnrenner', 'Lyst til halvskygge', 7, 30, 18, false, 'Lager avleggere. Trygg for kjæledyr.'),
  ('Dracaena marginata', 'Dragetre', 'Lyst, indirekte', 10, 60, 24, true, 'Tåler litt tørke mellom vanning.'),
  ('Aloe vera', 'Aloe vera', 'Mye lys / sol', 14, 60, 24, true, 'Sukkulent – la jorda tørke helt ut.'),
  ('Crassula ovata', 'Pengetre', 'Mye lys', 14, 60, 24, true, 'Sukkulent. Vann sparsomt.'),
  ('Phalaenopsis', 'Sommerfuglorkidé', 'Lyst, indirekte', 7, 14, 24, false, 'Vann ved å dyppe. Unngå stillestående vann.'),
  ('Pelargonium', 'Pelargonia', 'Mye lys / sol', 5, 14, 12, true, 'Liker sol. Fjern visne blomster.'),
  ('Calathea', 'Pråktblad', 'Halvskygge, ikke direkte sol', 5, 30, 18, false, 'Liker høy luftfuktighet og romtemperert vann.'),
  ('Maranta leuconeura', 'Bønneplante', 'Halvskygge', 5, 30, 18, false, 'Bladene folder seg sammen om natten.'),
  ('Aglaonema', 'Kinatre', 'Halvskygge til lyst', 7, 30, 24, true, 'Hardfør og tåler lite lys.'),
  ('Dieffenbachia', 'Dieffenbachia', 'Lyst, indirekte', 7, 30, 24, true, 'Saften irriterer – hold unna barn og dyr.'),
  ('Philodendron hederaceum', 'Hjertephilodendron', 'Halvskygge til lyst', 7, 30, 24, true, 'Lettstelt klatre- og hengeplante.'),
  ('Anthurium andraeanum', 'Flamingoblomst', 'Lyst, indirekte', 7, 30, 24, true, 'Blomstrer lenge ved godt lys.'),
  ('Hedera helix', 'Eføy', 'Lyst til halvskygge', 7, 30, 18, true, 'Liker kjølig og luftig plassering.'),
  ('Tradescantia zebrina', 'Sølvranke', 'Mye lys', 7, 30, 12, true, 'Klyp tilbake for fyldig vekst.'),
  ('Chamaedorea elegans', 'Stuepalme', 'Halvskygge', 7, 30, 24, false, 'Trygg palme for kjæledyr.'),
  ('Howea forsteriana', 'Kentiapalme', 'Halvskygge til lyst', 7, 30, 36, false, 'Tålmodig og hardfør palme.'),
  ('Yucca elephantipes', 'Yucca', 'Mye lys / sol', 14, 60, 36, true, 'Tåler tørke. Vann sjelden.'),
  ('Schefflera arboricola', 'Paraplytre', 'Lyst, indirekte', 7, 30, 24, true, 'Klyp for buskete vekst.'),
  ('Peperomia', 'Peperomia', 'Halvskygge til lyst', 10, 30, 24, false, 'Tykke blader lagrer vann. Trygg for dyr.'),
  ('Pilea peperomioides', 'Pannekakeplante', 'Lyst, indirekte', 7, 30, 18, false, 'Snu jevnlig mot lyset. Lager avleggere.'),
  ('Hoya carnosa', 'Voksblomst', 'Lyst, indirekte', 10, 30, 36, false, 'Ikke fjern blomsterstilkene. Trygg for dyr.'),
  ('Senecio rowleyanus', 'Perlekjede', 'Mye lys', 14, 60, 24, true, 'Sukkulent hengeplante. Vann sparsomt.'),
  ('Saintpaulia ionantha', 'Usambarafiol', 'Lyst, indirekte', 5, 30, 12, false, 'Vann nedenfra. Unngå vann på bladene.'),
  ('Kalanchoe blossfeldiana', 'Ildtopp', 'Mye lys', 10, 30, 18, true, 'Sukkulent. La jorda tørke mellom vanning.'),
  ('Asplenium nidus', 'Fuglereirbregne', 'Halvskygge', 5, 30, 24, false, 'Liker fukt. Ikke vann ned i hjertet.'),
  ('Nephrolepis exaltata', 'Sverdbregne', 'Halvskygge', 4, 30, 18, false, 'Hold jevnt fuktig. Liker høy luftfuktighet.'),
  ('Aspidistra elatior', 'Jernplante', 'Skygge til halvskygge', 10, 60, 36, false, 'Ekstremt hardfør. Tåler lite lys.'),
  ('Codiaeum variegatum', 'Croton', 'Mye lys', 7, 30, 24, true, 'Trenger godt lys for sterke farger.'),
  ('Beaucarnea recurvata', 'Elefantfot', 'Mye lys', 14, 60, 36, false, 'Lagrer vann i stammen. Vann sjelden.'),
  ('Strelitzia reginae', 'Paradisfugl', 'Mye lys / sol', 7, 30, 24, true, 'Stor plante. Trenger mye lys for blomstring.'),
  ('Begonia maculata', 'Prikkbegonia', 'Lyst, indirekte', 7, 30, 18, true, 'Liker fuktig luft. Unngå våte blader.'),
  ('Echeveria', 'Echeveria', 'Mye lys / sol', 14, 60, 24, false, 'Rosettsukkulent. La jorda tørke helt ut.')
on conflict (lower(latin_name)) do nothing;
