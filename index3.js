const fs = require('fs');
const axios = require('axios');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const { convert } = require('html-to-text');
const cheerio = require('cheerio');

async function scrape(link, onlyOutline) {
    let response = {}
    try {
        response = await axios.get("http://api.scraperapi.com?api_key=ab217d454f8461ad658ac0652b175995&url=" + link);
    } catch (e) {
        console.log(e);
    }

    const { document } = new JSDOM(response.data).window;
    const reader = new Readability(document);
    const article = reader.parse();

    if (!article)
        return "The given link is not accessible, please try some other link";

    if (onlyOutline && article.content) {
        const $ = cheerio.load(article.content);
        // Remove all links from the outline
        $('a').replaceWith(function () { return $(this).contents(); });

        let collection = `<h1>${article.title}</h1>\n`;
        $('h1, h2, h3, h4, h5').each((index, element) => {
            element.attribs = {};
            collection += $(element).html() + "\n";
        });
        return { title: article.title, collection };
    }

    if (!article.content) {
        return "UNABLE TO SCRAPE";
    }

    // Load the article content into Cheerio and remove links
    const $ = cheerio.load(article.content);
    $('a').replaceWith(function () { return $(this).contents(); });

    const cleanedContent = $.html();
    const options = {
        wordwrap: 130,
    };

    const finalArticle = convert(cleanedContent, options);
    return { title: article.title, finalArticle };
}


const apiKey = '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'; // Replace with your actual OpenAI API key

function readURLsFromFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split('\n').filter(line => line.trim() !== '');
}

const API_URL = 'https://api.openai.com/v1/chat/completions';

async function callGPTAPI(message) {
    try {
        const response = await axios.post(API_URL, {
            model: 'gpt-3.5-turbo-16k',
            temperature: 0.4,
            top_p: 1,
            messages: [
                { role: 'system', content: 'You are a helpful assistant. Return your response as either "Tech-Related" , "Slightly Tech Related" and "Non-Tech Related" based on the criteria described by the user' },
                { role: 'user', content: message }
            ]
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error("Error calling GPT API:", error);
        return null;
    }
}

async function processURLs(urls) {
    for (const url of urls) {
        const scrapedContent = await scrape(url, false);
        if (!scrapedContent || typeof scrapedContent === 'string') {
            console.error(`Error scraping URL: ${url}`);
            continue;
        }

        const message = `
        
        
        You are an assistant tasked with categorizing blog posts for makeuseof.com, a site focused on technology. 
        Your job is to analyze the content of each article and categorize it as either 'Tech-Related' or 'Non-Tech Related'.

        Criteria for 'Tech-Related':
        - The article directly discusses technology, such as gadgets, software, or internet services.
        - The subject is about the application or impact of technology in various fields.
        - The content includes guides or how-tos related to using technology or internet-based services.
        - Articles about lists of apps, websites, or how-tos on internet-related activities are considered 'Tech-Related'.
        - Articles about list of websites and apps for a topic. exammple best websites for XYZ or best apps ABC

        Criteria for 'Slightly Tech Related':
        - The article integrates technology into broader topics, where technology is not the primary focus but plays a notable role in the discussion.
        - Topics may include lifestyle, culture, or health, where technology is used as a tool or medium, such as fitness apps, digital photography, or online education platforms.
        - Articles that discuss the societal or ethical implications of technology, like privacy concerns in social media or the environmental impact of electronic waste.
        - Content that covers emerging tech trends or introductory tech concepts in a broader context, like an overview of smart home devices in home improvement, or basic explanations of blockchain in financial articles.
        - Articles that explore the intersection of technology with other fields, such as art, travel, or cooking, where technology is a component but not the main subject, like travel blogs that focus on using apps for navigation or cooking blogs discussing kitchen gadgets.

        Criteria for 'Non-Tech Related':
        - The article primarily focuses on lifestyle topics without a significant link to technology.
        - Topics include general wellness, dating, TV shows, and entertainment without a clear technology angle.
        - Note that topics that talk about a list of apps or websites are tech related because they talk about the internet which is partly tech related

        Examples of Blog Post Title Categorization:

        Electric Vehicles (EVs)
        - Tech Related: "What Is Hyundai Bluelink, and What Does It Do?", "7 Fixes for When Apple CarPlay Won't Work"
        - Non-Tech Related: "8 Things That Make the 2023 Toyota BZ4X a Worthy Tesla Rival", "Lucid Air vs. Tesla Model S: Which Luxury EV Is Best?"

        Wellness
        - Tech Related: "How to Connect a Fitbit to Apple Health", "The 9 Best Strava Tips and Tricks"
        - Non-Tech Related: "Find Your Zen Before Your Baby Comes Using These 9 Online Yoga Programs", "The Best Exercises That Aren't About Weight Loss for Better Long-Term Health"

        Social Media
        - Tech Related: "How to Recover Lost Drafts on TikTok", "What Do the Check Marks in Telegram Mean?"
        - Non-Tech Related: "8 Ways to Avoid Being 'That Guy' on Tinder", "The Best Prank Phone Numbers to Hand a Bad Date at the End of the Night"

        Gaming
        - Tech Related: "How to Use a PS4 Controller on Your PC or Mac", "5 Ways You Can Maintain Your Xbox Series X Hardware"
        - Non-Tech Related: "The 10 Best Stardew Valley Mods", "The Complete Guide to Shiny Hunting in Pokémon Scarlet and Violet"

        Entertainment
        - Tech Related: "What Is YouTube's Super Chat Feature and How Do You Use It?", "8 Twitch Features Every User Should Know"
        - Non-Tech Related: "The Best Spotify Playlists to Use as Background Music", "The 22 Best YouTube Channels You Should Watch Next"

        Work & Career
        - Tech Related: "How to Ace Your Technical Interview", "How to Create a Resume Using Canva"
        - Non-Tech Related: "5 Reasons You Should Never Underprice Your Services as a Freelancer", "10 Factors to Negotiate Besides Salary in a Job Interview"

        Notes:

        Any articles about list of apps or websites are "tech related"
        Articles like "You Can Now Listen to Apple Music on the Web" is also "tech related" as it talk about technology. 
        how to guides on how to do something on the internet are also "tech related."

        Based on these guidelines and examples, please analyze the following content and categorize it as either 'Tech-Related' or 'Non-Tech Related'.

        Here's the article you need to analyse:

        
        :\n\n${scrapedContent.finalArticle}`;

        console.log(`prompt is \n ${message}`);
        const csvOutput = await callGPTAPI(message);
        if (csvOutput) {
            fs.appendFileSync('output.csv', `${url},${csvOutput}\n`);
        }
    }
}

const urls = readURLsFromFile('urls.txt');
processURLs(urls);