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

    const dataHoje = dayjs();
    const horaAtual = dataHoje.format('HH:mm:ss'); 

    console.log(newParticipant.lastStatus);

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

app.listen(PORT, console.log(`Servidor rodando na porta ${PORT}`));

