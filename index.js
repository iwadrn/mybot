const { Client, GatewayIntentBits, Partials, Collection, EmbedBuilder } = require("discord.js");
const fs = require('fs');
const path = require('path')
const yaml = require('js-yaml');
const cron = require('node-cron')
const moment = require('moment')

const { refreshCommand } = require("./src/slash/slash");
const { connectDB } = require("./src/database/database");
const ServerList = require('./src/database/schema/server')

const yamlData = yaml.load(fs.readFileSync('config.yml', 'utf8'));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [
    Partials.GuildMember,
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
  ], //partials
});

//load command bot
const commandPath = path.join(__dirname, "src/commands");
const eventPath = path.join(__dirname, "src/events");
refreshCommand();

client.commands = new Collection();

client.login(yamlData["tokenBot"]);
client.setMaxListeners(0);

client.on("ready", () => {
  connectDB()  
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', message => {
  console.log(`Received message: ${message.content}`);
  
  if (message.content.toLowerCase() === 'qris') {
    console.log('Detected "qris"');
    message.reply('https://cdn.discordapp.com/attachments/1210537171031826462/1224985580895731800/20240403_143453.png?ex=6628b639&is=662764b9&hm=e00ff29b890faa1407049358ba2378baaf183eef7a451cb452cc700ff83ff0ad');
  } else if (message.content.startsWith('!ping')) {
    message.reply('Pong!');
  } else if (message.content.toLowerCase() === 'tes') {
    message.channel.send('Tes berhasil!');
  }
});


const readCommands = (folderPath) => {
  const files = fs.readdirSync(folderPath);
  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      readCommands(filePath);
    } else if (file.endsWith(".js")) {
      const command = require(filePath);
      if ("data" in command && "execute" in command) {
        client.commands.set(command.data.name, command);
      } else {
        console.log(
          `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
        );
      }
    }
  }
};

const readEventsFolder = (folderPath, client) => {
    const files = fs.readdirSync(folderPath);
  
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        readEventsFolder(filePath, client);
      } else if (file.endsWith(".js")) {
        const event = require(filePath);
  
        if (event.once) {
          client.once(event.name, (...args) => event.execute(...args));
        } else {
          client.on(event.name, (...args) => event.execute(...args));
        }
      }
    }
};

//cron 10minutes
cron.schedule('*/1 * * * *', async () => {
  const allServer = await ServerList.find({ warning: false })

  for (server of allServer) {
    const cekTanggal = moment(server.Expired, 'YYYY-MM-DD');
    const tanggalSekarang = moment();

    if (cekTanggal.isBefore(tanggalSekarang, "day") || cekTanggal.isSame(tanggalSekarang, "day")) {
      await ServerList.updateOne({ discordId: server.discordId, Expired: server.Expired }, { $set: { warning: true } })
      
      const embed = new EmbedBuilder()
      .setTitle("INFORMATION📢")
      .setColor(0x6AD4DD)
      .setDescription(`Haloo hostingan kamu yang ada di Node : **${server.node}** dengan Ram : **${server.ram}** telah **EXPIRED**, Harap hubungi owner untuk perpanjangan..\n\n||Terimakasih🙏||`)
      .setTimestamp()
      .setFooter({ text: "IWARDN BOTS" })

      await client.users.send(server.discordId, { embeds: [embed] })
    }
  }
})

readCommands(commandPath)
readEventsFolder(eventPath, client)