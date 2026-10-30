-- Фото рецептов, партия images-01: 20 шт.
-- СГЕНЕРИРОВАНО из content/recipes/images-01.json (node scripts/recipes/build-images-migration.ts images-01).
-- Не редактировать вручную; после применения к облаку партию не менять.
-- Фото — копии с Wikimedia Commons со свободной лицензией; автор и лицензия — в подписи.

-- bananovyi-hleb: Banana bread 001.jpg
update public.recipes r set image_url = '/recipe-images/bananovyi-hleb.jpg', image_credit = 'Фото: jules, CC BY 2.0, Wikimedia Commons',
  image_source_url = 'https://commons.wikimedia.org/wiki/File:Banana_bread_001.jpg'
from public.recipe_sources s
where r.source_id = s.id and s.url = 'https://ru.wikibooks.org/wiki/Рецепт:Банановый_хлеб';

-- befstroganov: Бефстроганов (мясное блюдо).jpg
update public.recipes r set image_url = '/recipe-images/befstroganov.jpg', image_credit = 'Фото: Eraevsky, CC BY-SA 4.0, Wikimedia Commons',
  image_source_url = 'https://commons.wikimedia.org/wiki/File:%D0%91%D0%B5%D1%84%D1%81%D1%82%D1%80%D0%BE%D0%B3%D0%B0%D0%BD%D0%BE%D0%B2_(%D0%BC%D1%8F%D1%81%D0%BD%D0%BE%D0%B5_%D0%B1%D0%BB%D1%8E%D0%B4%D0%BE).jpg'
from public.recipe_sources s
where r.source_id = s.id and s.url = 'https://ru.wikibooks.org/wiki/Рецепт:Бефстроганов';

-- bliny-presnye: 03.03.2008-094.jpg
update public.recipes r set image_url = '/recipe-images/bliny-presnye.jpg', image_credit = 'Фото: Loyna, CC BY-SA 3.0, Wikimedia Commons',
  image_source_url = 'https://commons.wikimedia.org/wiki/File:03.03.2008-094.jpg'
from public.recipe_sources s
where r.source_id = s.id and s.url = 'https://ru.wikibooks.org/wiki/Рецепт:Блины';

-- brauni: Brownies on white.jpeg
update public.recipes r set image_url = '/recipe-images/brauni.jpg', image_credit = 'Фото: Theopolisme, CC BY-SA 3.0, Wikimedia Commons',
  image_source_url = 'https://commons.wikimedia.org/wiki/File:Brownies_on_white.jpeg'
from public.recipe_sources s
where r.source_id = s.id and s.url = 'https://ru.wikibooks.org/wiki/Рецепт:Брауни';

-- draniki: Potato pancakes.jpg
update public.recipes r set image_url = '/recipe-images/draniki.jpg', image_credit = 'Фото: Photo made by Daniel Spils and uploaded to flickr.com, CC BY-SA 2.0, Wikimedia Commons',
  image_source_url = 'https://commons.wikimedia.org/wiki/File:Potato_pancakes.jpg'
from public.recipe_sources s
where r.source_id = s.id and s.url = 'https://ru.wikibooks.org/wiki/Рецепт:Драники';

-- golubcy-myasnye: Holubtsi.jpg
update public.recipes r set image_url = '/recipe-images/golubcy-myasnye.jpg', image_credit = 'Фото: Stefaniafleur, CC BY-SA 4.0, Wikimedia Commons',
  image_source_url = 'https://commons.wikimedia.org/wiki/File:Holubtsi.jpg'
from public.recipe_sources s
where r.source_id = s.id and s.url = 'https://ru.wikibooks.org/wiki/Рецепт:Голубцы';

-- gorohovyi-sup: Yellow Split Pea Soup.jpg
update public.recipes r set image_url = '/recipe-images/gorohovyi-sup.jpg', image_credit = 'Фото: Qfamily, CC BY-SA 2.0, Wikimedia Commons',
  image_source_url = 'https://commons.wikimedia.org/wiki/File:Yellow_Split_Pea_Soup.jpg'
from public.recipe_sources s
where r.source_id = s.id and s.url = 'https://ru.wikibooks.org/wiki/Рецепт:Гороховый_суп';

-- grechnevaya-kasha: Гречневая каша.jpg
update public.recipes r set image_url = '/recipe-images/grechnevaya-kasha.jpg', image_credit = 'Фото: Laitr Keiows, CC BY-SA 3.0, Wikimedia Commons',
  image_source_url = 'https://commons.wikimedia.org/wiki/File:%D0%93%D1%80%D0%B5%D1%87%D0%BD%D0%B5%D0%B2%D0%B0%D1%8F_%D0%BA%D0%B0%D1%88%D0%B0.jpg'
from public.recipe_sources s
where r.source_id = s.id and s.url = 'https://ru.wikibooks.org/wiki/Рецепт:Гречневая_каша';

-- kartofelnoe-pyure: MashedPotatoes.jpg
update public.recipes r set image_url = '/recipe-images/kartofelnoe-pyure.jpg', image_credit = 'Фото: Renee Comet (photographer), Public domain, Wikimedia Commons',
  image_source_url = 'https://commons.wikimedia.org/wiki/File:MashedPotatoes.jpg'
from public.recipe_sources s
where r.source_id = s.id and s.url = 'https://ru.wikibooks.org/wiki/Рецепт:Картофельное_пюре';

-- makarony-po-flotski: Navy-style 2020-01-30 Макароны «по-флотски».jpg
update public.recipes r set image_url = '/recipe-images/makarony-po-flotski.jpg', image_credit = 'Фото: Zuzu172, CC BY-SA 4.0, Wikimedia Commons',
  image_source_url = 'https://commons.wikimedia.org/wiki/File:Navy-style_2020-01-30_%D0%9C%D0%B0%D0%BA%D0%B0%D1%80%D0%BE%D0%BD%D1%8B_%C2%AB%D0%BF%D0%BE-%D1%84%D0%BB%D0%BE%D1%82%D1%81%D0%BA%D0%B8%C2%BB.jpg'
from public.recipe_sources s
where r.source_id = s.id and s.url = 'https://ru.wikibooks.org/wiki/Рецепт:Макароны_по-флотски';

-- oladi-drozhzhevye: ОладкиУкраїнські.jpg
update public.recipes r set image_url = '/recipe-images/oladi-drozhzhevye.jpg', image_credit = 'Фото: Kozubenko, CC BY-SA 4.0, Wikimedia Commons',
  image_source_url = 'https://commons.wikimedia.org/wiki/File:%D0%9E%D0%BB%D0%B0%D0%B4%D0%BA%D0%B8%D0%A3%D0%BA%D1%80%D0%B0%D1%97%D0%BD%D1%81%D1%8C%D0%BA%D1%96.jpg'
from public.recipe_sources s
where r.source_id = s.id and s.url = 'https://ru.wikibooks.org/wiki/Рецепт:Оладьи';

-- olive: Russischer Oliviersalat.JPG
update public.recipes r set image_url = '/recipe-images/olive.jpg', image_credit = 'Фото: Dr. Bernd Gross, CC BY-SA 4.0, Wikimedia Commons',
  image_source_url = 'https://commons.wikimedia.org/wiki/File:Russischer_Oliviersalat.JPG'
from public.recipe_sources s
where r.source_id = s.id and s.url = 'https://ru.wikibooks.org/wiki/Рецепт:Оливье';

-- plov-ferganskii: Plov Tashkent.jpg
update public.recipes r set image_url = '/recipe-images/plov-ferganskii.jpg', image_credit = 'Фото: Ekrem Canli, CC BY-SA 3.0, Wikimedia Commons',
  image_source_url = 'https://commons.wikimedia.org/wiki/File:Plov_Tashkent.jpg'
from public.recipe_sources s
where r.source_id = s.id and s.url = 'https://ru.wikibooks.org/wiki/Рецепт:Плов';

-- salat-nisuaz: Salade niçoise 001.jpg
update public.recipes r set image_url = '/recipe-images/salat-nisuaz.jpg', image_credit = 'Фото: Arnaud 25, CC BY-SA 4.0, Wikimedia Commons',
  image_source_url = 'https://commons.wikimedia.org/wiki/File:Salade_ni%C3%A7oise_001.jpg'
from public.recipe_sources s
where r.source_id = s.id and s.url = 'https://ru.wikibooks.org/wiki/Рецепт:Салат_Нисуаз';

-- shakshuka: Shakshuka by Calliopejen1.jpg
update public.recipes r set image_url = '/recipe-images/shakshuka.jpg', image_credit = 'Фото: Calliopejen1, CC BY-SA 3.0, Wikimedia Commons',
  image_source_url = 'https://commons.wikimedia.org/wiki/File:Shakshuka_by_Calliopejen1.jpg'
from public.recipe_sources s
where r.source_id = s.id and s.url = 'https://ru.wikibooks.org/wiki/Рецепт:Шакшука';

-- shvedskie-frikadelki: Köttbullar - Swedish meatballs.jpg
update public.recipes r set image_url = '/recipe-images/shvedskie-frikadelki.jpg', image_credit = 'Фото: Jonas Nordström, CC BY 2.0, Wikimedia Commons',
  image_source_url = 'https://commons.wikimedia.org/wiki/File:K%C3%B6ttbullar_-_Swedish_meatballs.jpg'
from public.recipe_sources s
where r.source_id = s.id and s.url = 'https://ru.wikibooks.org/wiki/Рецепт:Шведские_фрикадельки';

-- syrniki: Syrniki6.jpg
update public.recipes r set image_url = '/recipe-images/syrniki.jpg', image_credit = 'Фото: Tatyana Morozyuk, color processing by Off-shell, CC BY-SA 3.0, Wikimedia Commons',
  image_source_url = 'https://commons.wikimedia.org/wiki/File:Syrniki6.jpg'
from public.recipe_sources s
where r.source_id = s.id and s.url = 'https://ru.wikibooks.org/wiki/Рецепт:Сырники';

-- tefteli-v-tomate: Tefteli.JPG
update public.recipes r set image_url = '/recipe-images/tefteli-v-tomate.jpg', image_credit = 'Фото: Kagor из украинский Википедия, CC BY-SA 3.0, Wikimedia Commons',
  image_source_url = 'https://commons.wikimedia.org/wiki/File:Tefteli.JPG'
from public.recipe_sources s
where r.source_id = s.id and s.url = 'https://ru.wikibooks.org/wiki/Рецепт:Тефтели';

-- valdorfskii-salat: Waldorf Salad.jpg
update public.recipes r set image_url = '/recipe-images/valdorfskii-salat.jpg', image_credit = 'Фото: Hennem08, CC BY-SA 3.0, Wikimedia Commons',
  image_source_url = 'https://commons.wikimedia.org/wiki/File:Waldorf_Salad.jpg'
from public.recipe_sources s
where r.source_id = s.id and s.url = 'https://ru.wikibooks.org/wiki/Рецепт:Вальдорфский_салат';

-- vinegret: Vinegret cleaned.jpg
update public.recipes r set image_url = '/recipe-images/vinegret.jpg', image_credit = 'Фото: Loyna (original image) ; processed by Off-shell, CC BY-SA 2.5, Wikimedia Commons',
  image_source_url = 'https://commons.wikimedia.org/wiki/File:Vinegret_cleaned.jpg'
from public.recipe_sources s
where r.source_id = s.id and s.url = 'https://ru.wikibooks.org/wiki/Рецепт:Винегрет';

-- Каждое фото должно найти свой рецепт.
do $$ begin
  if (select count(*) from public.recipes where image_url like '/recipe-images/%') < 20 then
    raise exception 'не все фото партии images-01 нашли рецепт';
  end if;
end; $$;
