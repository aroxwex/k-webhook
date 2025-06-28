const { Client, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
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

// Sabit değerler
const whitelistChannelName = 'whitelist'; // Test için basit isim
const logChannelName = 'whitelist-log'; // Test için basit isim
const authorizedRoleId = '1387885041115463830'; // Yetkili rolün ID'si
const targetRoleId = '1387797050065682462'; // Verilecek rolün ID'si
const reactionEmojiId = '1387809434675183668'; // Özel emoji ID'si (mc_onay)

// Express sunucusu
app.get('/ping', (req, res) => {
    res.send('Bot aktif!');
});

app.get('/', (req, res) => {
    res.send('Ana sayfa! Bot çalışıyor.');
});

const port = process.env.PORT || 10000;
app.listen(port, () => {
    console.log(`Web sunucusu ${port} portunda çalışıyor`);
});

client.once('ready', () => {
    console.log(`${client.user.tag} olarak giriş yapıldı!`);
    console.log('Botun bağlı olduğu sunucular:', client.guilds.cache.map(g => `${g.name} (${g.id})`).join(', '));
});

// Mesaj olayını debug etmek için
client.on('messageCreate', async message => {
    if (!message.guild || !message.content.startsWith('-') || message.author.bot) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'ping') {
        console.log(`Ping komutu çalıştırıldı: ${message.author.tag}`);
        try {
            await message.reply(`Botun pingi: ${client.ws.ping}ms`);
        } catch (error) {
            console.error('Ping cevabı gönderilemedi:', error);
        }
    }
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
    if (!guild) return;

    const member = await guild.members.fetch(user.id).catch(err => {
        console.error('Kullanıcı alınamadı:', err);
        return null;
    });

    if (!member) return;

    // Whitelist kanalında mı kontrol et
    if (message.channel.name.toLowerCase() !== whitelistChannelName.toLowerCase()) return;

    // Tepki doğru emoji mi kontrol et
    if (reaction.emoji.id !== reactionEmojiId && reaction.emoji.name !== 'mc_onay') return;

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
        console.log(`Rol verildi: ${targetMember.user.tag} -> ${targetRoleId}`);

        // Log kanalına embed mesaj gönder
        const logChannel = guild.channels.cache.find(ch => ch.name.toLowerCase() === logChannelName.toLowerCase());
        if (logChannel && logChannel.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages)) {
            const embed = new EmbedBuilder()
                .setColor('#34632b')
                .setTitle('Whitelist Rol Atama')
                .addFields(
                    { name: 'Üye', value: `${targetMember.user.tag}`, inline: true },
                    { name: 'Mesaj', value: message.content || '*Boş mesaj*', inline: true },
                    { name: 'Yetkili', value: `${user.tag}`, inline: true }
                )
                .setTimestamp();
            await logChannel.send({ embeds: [embed] });
        } else {
            console.error(`Log kanalı bulunamadı veya izin eksik: ${logChannelName}`);
        }
    } catch (error) {
        console.error('Rol verme hatası:', error);
        const logChannel = guild.channels.cache.find(ch => ch.name.toLowerCase() === logChannelName.toLowerCase());
        if (logChannel && logChannel.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages)) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Hata')
                .setDescription(`Rol verme işlemi sırasında bir hata oluştu: ${error.message}`)
                .setTimestamp();
            await logChannel.send({ embeds: [errorEmbed] });
        }
    }
});

client.on('error', error => {
    console.error('WebSocket hatası:', error);
});

client.on('warn', warning => {
    console.warn('Uyarı:', warning);
});

client.login(process.env.BOT_TOKEN).catch(error => {
    console.error('Giriş hatası:', error);
});
