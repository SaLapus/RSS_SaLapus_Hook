const http = require("http");
const fs = require("fs");

module.exports = {
    getVolumeInfo: function(variables) {
        const postData = JSON.stringify({
            operationName: "Volume",
            variables,
            query: `query Volume($url: String) {
                project(project: { fullUrl: $url }) {
                    id
                    title
                    url
                    __typename
                }
                volume(volume: { fullUrl: $url }) {
                    id
                    url
                    externalUrl
                    file
                    title
                    titles(
                        langs: ["jp", "cn", "romaji", "translit", "pinyin", "en", "ru", "*"]
                    ) {
                        lang
                        value
                        __typename
                    }
                    type
                    shortName
                    lastUpdate
                    status
                    statusHint
                    staff {
                        memberId
                        userId
                        nickname
                        team {
                            id
                            name
                            website
                            __typename
                        }
                        teamShowLabel
                        activityName
                        activityType
                        __typename
                    }
                    teams {
                        team {
                            id
                            name
                            website
                            __typename
                        }
                        prefix
                        suffix
                        __typename
                    }
                    isbn
                    annotation {
                        text
                        __typename
                    }
                    covers {
                        thumbnail(width: 240)
                        url
                        __typename
                    }
                    chapters {
                        id
                        parentChapterId
                        volumeId
                        url
                        title
                        publishDate
                        published
                        __typename
                    }
                    next {
                        volumeId
                        url
                        title
                        shortTitle
                        __typename
                    }
                    prev {
                        volumeId
                        url
                        title
                        shortTitle
                        __typename
                    }
                    topicId
                    __typename
                }
            }
             `
        });

        const options = {
            hostname: "api.novel.tl",
            port: 80,
            path: "/api/site/v2/graphql",
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(postData)
            }
        };

        let message = "";

        return new Promise(resolve => {
            const req = http.request(options, res => {
                console.log(`STATUS: ${res.statusCode}`);

                res.setEncoding("utf8");

                res.on("data", chunk => {
                    if (chunk != undefined) message += chunk; //переделать под поток
                });

                res.on("end", () => {
                    fs.writeFileSync("logs_volume.json", `${message}`)
                    resolve(JSON.parse(message).data);
                });
            });

            req.on("error", e => {
                console.error(`problem with request: ${e.message}`);
            });

            // write data to request body
            req.write(postData);
            req.end();
        });
    }
};
