import express from 'express'
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from "dotenv"
import Joi from "joi"
import dayjs from 'dayjs';

const PORT = 5000;

const app = express();
app.use(cors());
app.use(express.json());
dotenv.config()

const mongoClient = new MongoClient(process.env.DATABASE_URL)
let db

mongoClient.connect()
    .then(() => db = mongoClient.db())
    .catch((err) => console.log(err.message))

app.post('/participants', async (req, res) => {

    const { name } = req.body;
    
    const schemaParticipant = Joi.object({
        name: Joi.string().required().min(1)
    })
    
    const validation = schemaParticipant.validate(req.body, {abortEarly: false})
    
    if (validation.error){
        return res.sendStatus(422);
    }

    const user = await db.collection("participants").findOne({ name: name });

    if (user) {
        return res.sendStatus(409);
    } 

    const newParticipant = {
		name: name,
		lastStatus: Date.now()
    }

    const horaAtual = dayjs().format('HH:mm:ss'); 

    const logMessage = { 
		from: name,
		to: 'Todos',
		text: 'entra na sala...',
		type: 'status',
		time: horaAtual
    }
    
    try {
        await db.collection("participants").insertOne(newParticipant)
        await db.collection("messages").insertOne(logMessage)
        res.sendStatus(201)
    }
    catch (err){
        res.status(500).send(err.message)
    }
});

app.get('/participants', async (req, res) => {

    try{
        const participants = await db.collection("participants").find().toArray();
        if(!participants){
            return res.send([]);
        }
        res.send(participants);
    }
    catch(err){
        res.status(500).send(err.message);
    }
});

app.post('/messages', async (req, res) => {

    const { to, text, type } = req.body;
    const user = req.headers.user;
    console.log(user);

    const userExist = await db.collection("participants").findOne({name: user});

    if (!user || !userExist){
        return res.sendStatus(422);
    }

    let horaAtual = dayjs().format('HH:mm:ss'); 

    const newMessage = {
        from: user,
        to: to,
        text: text,
        type: type,
        time: horaAtual
    }
    
    const schemaMessage = Joi.object({
        to: Joi.string().required().min(1),
        text: Joi.string().required().min(1),
        type: Joi.string().required().valid('message', 'private_message')
    })
    
    const validation = schemaMessage.validate(req.body, {abortEarly: false})
    
    if (validation.error){
        return res.sendStatus(422);
    }

    try {
        await db.collection("messages").insertOne(newMessage)
        res.sendStatus(201)
    }
    catch (err){
        res.status(500).send(err.message)
    }
});

app.get('/messages', async (req, res) => {

    const user = req.headers.user;
    let limit = req.query.limit;

    if (limit !== undefined && (limit <= 0 || isNaN(limit))){
        return res.sendStatus(422);
    }
    limit = parseInt(limit);

    try{
        const messages = await db.collection("messages").find({$or: [{type: "message"}, {to:"Todos"}, {to: user}, {from: user}]}).toArray();
        let mensagens = messages;
        if(limit !== undefined){
            mensagens = messages.slice(-limit);
        }
        return res.send(mensagens);
    }
    catch(err){
        res.status(500).send(err.message);
    }
});

app.post('/status', async (req, res) => {

    const usuario = req.headers.user;

    if(!usuario){
        return res.sendStatus(404);
    }
    try {
        const result = await db.collection("participants").find({name: usuario}).toArray();
        console.log(result);
        if (!result){
            return res.sendStatus(404);
        }

        try{
            await db.collection("participants").updateOne({name: usuario}, {$set: {lastStatus: Date.now()}});
            res.sendStatus(200)
        }
        catch(err){
            res.status(500).send(err.message)
        }       
    }
    catch (err){
        res.status(500).send(err.message)
    }
});

setInterval(async () => {

    let tempoLimite = Date.now() - 10000;
    try {
        const usersOffline = await db.collection('participants').find({lastStatus:{$lt: tempoLimite}}).toArray();
        if (usersOffline.length > 0) {
            let mensagemSaida = usersOffline.map(user => {
                return {
                    from: user.name,
                    to: 'Todos',
                    text: 'sai da sala...',
                    type: 'status',
                    time: dayjs().format("HH:mm:ss")
                }
            });
            await db.collection('messages').insertMany(mensagemSaida);
            await db.collection('participants').deleteMany({lastStatus:{$lt:tempoLimite}});
        }
    } catch (err) {
        res.status(500).send(err.message);
    }
}, 15000);


app.listen(PORT, console.log(`Servidor rodando na porta ${PORT}`));

