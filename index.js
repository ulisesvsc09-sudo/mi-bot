require("dotenv").config();
const {
    Client,
    GatewayIntentBits,
    Partials,
    REST,
    Routes,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    InteractionType,
    PermissionsBitField
} = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

// ------------------
// ROLES DEL .ENV
// ------------------
const ROLES_SERVICIOS = {
    "paramedico": process.env.ROL_PARAMEDICO,
    "bomberos": process.env.ROL_BOMBEROS,
    "dot": process.env.ROL_DOT,
    "policia": process.env.ROL_POLICIA,
    "marina": process.env.ROL_MARINA
};

// CANAL DONDE LLEGAN SOLICITUDES
const canal911 = process.env.CANAL_REPORTES_ID;

// ------------------
// REGISTRO DE COMANDO
// ------------------
client.once("ready", async () => {
    console.log(`Bot conectado como ${client.user.tag}`);

    const comandos = [
        {
            name: "enviar-911",
            description: "Enviar panel del sistema 911"
        }
    ];

    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

    await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: comandos }
    );

    console.log("Comando /enviar-911 registrado.");
});

// ------------------
// SISTEMA 911 COMPLETO
// ------------------
client.on("interactionCreate", async interaction => {

    // -------------------------
    // COMANDO /enviar-911
    // -------------------------
    if (interaction.commandName === "enviar-911") {
        const embed = new EmbedBuilder()
            .setColor("#FF7B00")
            .setTitle("🚨 Centro de Emergencias 911")
            .setDescription(`
Selecciona el tipo de asistencia que necesitas:

🩺 **Paramédico**  
🔥 **Bomberos**  
🚧 **DOT**  
🚓 **Policía Estatal/Municipal**  
🛡️ **MARINA / SEDENA**
`);

        const boton911 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("abrir_menu_911")
                .setLabel("📞 Solicitar 911")
                .setStyle(ButtonStyle.Danger)
        );

        return interaction.reply({
            embeds: [embed],
            components: [boton911]
        });
    }

    // -------------------------
    // BOTÓN PARA ABRIR MENÚ
    // -------------------------
    if (interaction.customId === "abrir_menu_911") {

        const embed = new EmbedBuilder()
            .setColor("#FF7B00")
            .setTitle("🆘 Tipo de Asistencia")
            .setDescription("Selecciona el servicio que necesitas.");

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("servicio_911")
                .setPlaceholder("Seleccionar servicio…")
                .addOptions([
                    { label: "Paramédico", value: "paramedico", emoji: "🩺" },
                    { label: "Bomberos", value: "bomberos", emoji: "🔥" },
                    { label: "DOT", value: "dot", emoji: "🚧" },
                    { label: "Policía", value: "policia", emoji: "🚓" },
                    { label: "MARINA / SEDENA", value: "marina", emoji: "🛡️" }
                ])
        );

        return interaction.reply({
            embeds: [embed],
            components: [menu],
            ephemeral: true
        });
    }

    // -------------------------
    // FORMULARIO
    // -------------------------
    if (interaction.isStringSelectMenu() && interaction.customId === "servicio_911") {

        const servicio = interaction.values[0];

        const modal = new ModalBuilder()
            .setCustomId(`modal_911_${servicio}`)
            .setTitle("Formulario de Emergencia 911");

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("descripcion")
                    .setLabel("Descripción detallada *")
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("codigoPostal")
                    .setLabel("Código Postal *")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("ubicacion")
                    .setLabel("Ubicación precisa *")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            )
        );

        return interaction.showModal(modal);
    }

    // -------------------------
    // RECIBIR FORMULARIO 911
    // -------------------------
    if (interaction.type === InteractionType.ModalSubmit && interaction.customId.startsWith("modal_911_")) {

        const servicio = interaction.customId.replace("modal_911_", "");
        const descripcion = interaction.fields.getTextInputValue("descripcion");
        const codigoPostal = interaction.fields.getTextInputValue("codigoPostal");
        const ubicacion = interaction.fields.getTextInputValue("ubicacion");

        const usuario = interaction.user;
        const rolPing = ROLES_SERVICIOS[servicio];
        const canal = await client.channels.fetch(canal911);

        const servicioNombre = {
            paramedico: "Paramédico",
            bomberos: "Bomberos",
            dot: "DOT",
            policia: "Policía",
            marina: "MARINA / SEDENA"
        }[servicio];

        // Embed enviado al canal de reportes
        const embedSolicitud = new EmbedBuilder()
            .setColor("#FF3C00")
            .setAuthor({ name: "🚨 Centro de Emergencias 911" })
            .setTitle(`📞 Nueva Solicitud: ${servicioNombre}`)
            .setDescription(`
👤 **Solicitante:** <@${usuario.id}>
🆘 **Servicio:** \`${servicioNombre}\`
📄 **Descripción:**  
> ${descripcion}

📍 **CP:** ${codigoPostal}  
📌 **Ubicación:** ${ubicacion}

⏳ Un oficial responderá en breve...
`)
            .setTimestamp();

        const botones = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`aceptar_${servicio}_${usuario.id}_${descripcion}_${codigoPostal}_${ubicacion}`)
                .setLabel("🟩 Atender")
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId(`rechazar_${servicio}_${usuario.id}_${descripcion}_${codigoPostal}_${ubicacion}`)
                .setLabel("🟥 Rechazar")
                .setStyle(ButtonStyle.Danger)
        );

        await canal.send({
            content: `<@&${rolPing}>`,
            embeds: [embedSolicitud],
            components: [botones]
        });

        return interaction.reply({
            content: "📨 Tu solicitud fue enviada correctamente.",
            ephemeral: true
        });
    }

    // -------------------------
    // ACEPTAR SOLICITUD (MODIFICADO)
    // -------------------------
    if (interaction.customId.startsWith("aceptar_")) {

        const data = interaction.customId.split("_");
        const servicio = data[1];
        const usuarioID = data[2];
        const descripcion = data[3];
        const codigoPostal = data[4];
        const ubicacion = data[5];

        const servicioNombre = {
            paramedico: "Paramédico",
            bomberos: "Bomberos",
            dot: "DOT",
            policia: "Policía",
            marina: "MARINA / SEDENA"
        }[servicio];

        const guild = interaction.guild;
        const numero = Math.floor(Math.random() * 9999);

        // Crear canal privado
        const canalPrivado = await guild.channels.create({
            name: `llamada-${numero}`,
            type: 0,
            permissionOverwrites: [
                { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: usuarioID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ]
        });

        // Embed del canal privado (MODIFICADO)
        const embedPrivado = new EmbedBuilder()
            .setColor("#0099FF")
            .setAuthor({ name: "📂 Caso Asignado" })
            .setDescription(`
👮 **Oficial Encargado:**  
<@${interaction.user.id}> *(favor de coordinar con el ciudadano lo antes posible)*

🆘 **Servicio:** \`${servicioNombre}\`

📝 **Descripción:**  
> ${descripcion}

📍 **CP:** ${codigoPostal}  
📌 **Ubicación:** ${ubicacion}
`)
            .setTimestamp();

        const botonCierre = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`concluir_${interaction.user.id}_${servicio}`)
                .setLabel("✔️ Concluir Llamada")
                .setStyle(ButtonStyle.Success)
        );

        await canalPrivado.send({
            content: `<@${interaction.user.id}>`,
            embeds: [embedPrivado],
            components: [botonCierre]
        });

        // Embed de la solicitud aceptada (MODIFICADO)
        const embedAceptada = new EmbedBuilder()
            .setColor("#00C851")
            .setAuthor({ name: "✔️ Solicitud Aceptada" })
            .setDescription(`
🛡️ **Oficial Asignado:** <@${interaction.user.id}>
📞 **Servicio:** \`${servicioNombre}\`

📌 **Canal de Coordinación:**  
${canalPrivado}

La llamada ha sido tomada y un canal privado fue creado.
`)
            .setTimestamp();

        return interaction.update({
            embeds: [embedAceptada],
            components: []
        });
    }

    // -------------------------
    // CONCLUIR LLAMADA
    // -------------------------
    if (interaction.customId.startsWith("concluir_")) {

        const data = interaction.customId.split("_");
        const oficialID = data[1];
        const servicio = data[2];

        if (interaction.user.id !== oficialID) {
            return interaction.reply({
                content: "❌ Solo el oficial asignado puede concluir la llamada.",
                ephemeral: true
            });
        }

        const embedCierre = new EmbedBuilder()
            .setColor("#455A64")
            .setAuthor({ name: "🗂️ Caso Concluido" })
            .setDescription(`
🛡️ **Oficial:** <@${interaction.user.id}>
📞 **Servicio:** \`${servicio}\`

El caso ha sido concluido. El canal se eliminará en unos segundos.
`)
            .setTimestamp();

        await interaction.reply({ embeds: [embedCierre] });

        setTimeout(() => {
            interaction.channel.delete("Caso concluido.");
        }, 2000);
    }
});

// ------------------
client.login(process.env.TOKEN);
