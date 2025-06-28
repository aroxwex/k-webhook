const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const express = require('express');

const app = express();
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// Sabit değerler (gerekirse .env veya başka bir config dosyasına taşınabilir)
const whitelistChannelName = '🏳️・whitelist'; // Whitelist kanalının adı
const logChannelName = '🗒️・whitelist-log'; // Log kanalının adı
const authorizedRoleId = '1387885041115463830'; // Yetkili rolün ID'si
const targetRoleId = '1387797050065682462'; // Verilecek rolün ID'si
const reactionEmoji = '<:mc_onay:1387809434675183668>'; // Kullanılacak emoji

// Express sunucusu (uyku modunu önlemek için)
app.get('/ping', (req, res) => {
    res.send('Bot aktif!');
});

app.get('/', (req, res) => {
    res.send('Ana sayfa! Bot çalışıyor.');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Web sunucusu ${port} portunda çalışıyor`);
});

client.once('ready', () => {
    console.log(`${client.user.tag} olarak giriş yapıldı!`);
});

// Mesaj tepkisi eklendiğinde
client.on('messageReactionAdd', async (reaction, user) => {
    // Mesajın tamamını al (kısmi tepki kontrolü)
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Tepki alınamadı:', error);
            return;
        }
    }

    const message = reaction.message;
    const guild = message.guild;
    const member = await guild.members.fetch(user.id).catch(err => {
        console.error('Kullanıcı alınamadı:', err);
        return null;
    });

    if (!member) return;

    // Whitelist kanalında mı kontrol et
    if (message.channel.name !== whitelistChannelName) return;

    // Tepki doğru emoji mi kontrol et
    if (reaction.emoji.name !== reactionEmoji) return;

    // Tepkiyi koyan kişi yetkili role sahip mi kontrol et
    if (!member.roles.cache.has(authorizedRoleId)) return;

    // Mesajın sahibini al
    const targetMember = await guild.members.fetch(message.author.id).catch(err => {
        console.error('Mesaj sahibi alınamadı:', err);
        return null;
    });

    if (!targetMember) return;

    // Hedef role zaten sahip mi kontrol et
    if (targetMember.roles.cache.has(targetRoleId)) return;

    try {
        // Role ver
        await targetMember.roles.add(targetRoleId);

        // Log kanalına mesaj gönder
        const logChannel = guild.channels.cache.find(ch => ch.name === logChannelName);
        if (logChannel && logChannel.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages)) {
            await logChannel.send(`${targetMember.user.tag} kullanıcısına <@&${targetRoleId}> rolü ${user.tag} tarafından verildi.`);
        } else {
            console.error('Log kanalı bulunamadı veya mesaj gönderme izni yok!');
        }
    } catch (error) {
        console.error('Rol verme hatası:', error);
        if (logChannel && logChannel.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages)) {
            await logChannel.send('Rol verme işlemi sırasında bir hata ol出了: ' + error.message);
        }
    }
});

client.login(process.env.BOT_TOKEN);
