const fs = require("fs");
const { URL } = require("url");

const Parser = require("rss-parser");
const Discord = require("discord.js");

const { getVolumeInfo } = require("./vol_info");
const parser = new Parser();

const { init } = require("./botInit");

init();

const hook = new Discord.WebhookClient(
    process.env.HOOK_CAPTAINHOOK_ID,
    process.env.HOOK_CAPTAINHOOK_TOKEN
);

//получение информации о времени последней проверки
let feedInfo = "";
try {
    feedInfo = fs.readFileSync("rssInfo.json", {
        flag: "a+",
    });
    if (feedInfo) feedInfo = JSON.parse(feedInfo);
} catch (e) {
    console.error("Error in reading info file");
} finally {
    console.log(feedInfo);
}

setInterval(func, 5 * 60 * 1000);
func();
//запуск
async function func() {
    //получение ленты
    let feed = await parser.parseURL("https://ruranobe.ru/updates.rss");
    let items = feed.items;
    let rssNews = [];

    let oldTime = new Date(feedInfo.lastPostTime);
    

    //разбор ленты поштучно
    for (let i in items) {
       
        let newTime = new Date(items[i].pubDate);
        if (newTime <= oldTime) break;

        let item = parseRSSItem(items[i]);

        if (rssNews.length === 0) rssNews.push(item);
        else {
            let updated = rssNews[rssNews.length - 1];

            //если последний и предпоследний элементы имеют одинаковый проект
            //то объеденить их
            if (updated.project === item.project)
                updated.updated.push(...item.updated);
            else rssNews.push(item);
        }
    }

    if (rssNews.length !== 0) {

        feedInfo.lastPostTime = (new Date(items[0].pubDate)).getTime();
        fs.writeFileSync("rssInfo.json", JSON.stringify(feedInfo));
        //конвертация ленты в дискорд-сообщения
        for (let item of rssNews) {
            newRSSPost(item);
        }
        console.log("Новостей нет: " + new Date(items[0].pubDate));
    }
    else console.log("Новостей нет: " + new Date(feedInfo.lastPostTime));
}

hook.destroy();

//разбор элемента ленты для запроса
function parseRSSItem(item) {
    let time = new Date(item.pubDate);
    let link = new URL(item.link);

    let path = link.pathname;

    const RegPath = /r\/([A-Za-z_]*)\/([A-Za-z]*[0-9]*\.?[0-9]*)\/?([A-Za-z]*[0-9]*\.?[0-9]*)/; // /раздел/проект/том/глава

    let titleInfo = path.match(RegPath);

    let project = titleInfo[1];
    let volume = titleInfo[2].match(/([A-Za-z]*)([0-9]*\.?[0-9]*)/);
    let chapter = "";
    if (titleInfo[3] != undefined)
        chapter = titleInfo[3].match(/([A-Za-z]*)([0-9]*\.?[0-9]*)?/);
    else chapter = null;

    return {
        project,
        updated: [
            {
                time,
                volume: volume[0],
                VolumeId: volume[2],
                chapter: chapter ? chapter[0] : "none",
                chapterId: chapter ? chapter[2] : "none",
            },
        ],

        requestInfo: {
            hostname: link.hostname,
            url: link.hostname + link.pathname,
            project: project,
            volume: volume[0],
        },
    };
}

function newRSSPost(RSSPost) {
    //получение информации о тайтле
    getVolumeInfo(RSSPost.requestInfo).then((volumeInfo) => {
        let annotation = volumeInfo.volume.annotation;
        if (annotation != null) {
            annotation = annotation.text.match(/<p id="p0">(.+)<\/p>/);
            if (annotation != null) annotation = annotation[1];
            else annotation = "";
        } else annotation = "";

        let staff = "";
        for (let member of volumeInfo.volume.staff) {
            staff += `${member.activityName}: *${member.nickname}*\n`;
        }

        let updates = {
            //так как мы начинаем обработку RSS-ленты с первого сверху(самого раннего) элемента,
            //то и в RSSPost он попадает первым,
            //поэтому первый элемент самый поздний.
            firstTime: RSSPost.updated[RSSPost.updated.length - 1].time,
            lastTime: RSSPost.updated[0].time,
            chapters: "",
        };

        for (let chapter of volumeInfo.volume.chapters) {
            let chapterTime = new Date(chapter.publishDate);

            //console.log(`${chapter}\nchaptertime ${chapterTime}\nfirsttime   ${updates.firstTime}\nlasttime    ${updates.lastTime}\n\n`);

            if (
                updates.firstTime <= chapterTime &&
                chapterTime <= updates.lastTime
            ) {
                if (chapter.parentChapterId != null) {
                    for (let parentChapter of volumeInfo.volume.chapters)
                        if (parentChapter.id === chapter.parentChapterId)
                            updates.chapters += `${parentChapter.title} Часть ${chapter.title}\n`;
                } else updates.chapters += `${chapter.title}\n`;
            }
        }

        let thumbnail = volumeInfo.volume.covers[0].url.match(/\/images\/.*/);

        if (thumbnail != null) thumbnail = `https://ruranobe.ru${thumbnail[0]}`;
        else thumbnail = "https://i.imgur.com/QsFAQso.jpg";

        sendDiscordMessage({
            title: volumeInfo.volume.title,
            annotation,
            thumbnail,
            staff,
            url: `https://ruranobe.ru/r/${volumeInfo.project.url}/${volumeInfo.volume.url}`,
            chapters: updates.chapters,
        });
    });
}

function sendDiscordMessage({
    title,
    annotation,
    thumbnail,
    staff,
    url,
    chapters,
}) {
    let content = `**${title}**

${chapters}
[:link:Страница тайтла](${url})

${annotation}

${staff}`;

    const Attachment = new Discord.MessageAttachment(thumbnail);

    hook.send(content, Attachment);
}

// наименование глав и частей
// аннотации
