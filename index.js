const express = require("express");
const app = express();
const { MongoClient, ServerApiVersion } = require("mongodb");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;
require("dotenv").config();
app.use(cors());
app.use(express.json());
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mpjre.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJwt(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthoirized Access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCSESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden Access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    await client.connect();
    const serviceCollection = client.db("doctorsPortal").collection("services");
    const bookingCollection = client.db("doctorsPortal").collection("bookings");
    const userCollection = client.db("doctorsPortal").collection("user");
    app.get("/services", async (req, res) => {
      const query = {};
      const cursor = serviceCollection.find(query);
      const service = await cursor.toArray();
      res.send(service);
    });

    app.get("/users", verifyJwt, async (req, res) => {
      const allUsers = await userCollection.find().toArray();
      res.send(allUsers);
    });

    /*
    for booking 

    */
    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const query = {
        treatment: booking.treatment,
        date: booking.date,
        patient: booking.patient,
      };
      const exists = await bookingCollection.findOne(query);
      console.log(query);
      console.log(exists);
      if (exists) {
        return res.send({ success: false, booking: exists });
      }
      const result = await bookingCollection.insertOne(booking);
      return res.send({ success: true, booking: result });
    });

    app.get("/myappointment", verifyJwt, async (req, res) => {
      const user = req.query.user;
      const decodedEmail = req.decoded.email;
      if (user === decodedEmail) {
        const query = { patient: user };
        const bookings = await bookingCollection.find(query).toArray();
        res.send(bookings);
      } else {
        res.status(403).send({ message: "Unauthorized Access" });
      }
      //   try {
      //     const authorizationToken = req.headers.authorization

      //   const authToken = authorizationToken.split(" ")[1]

      //   const decoded = jwt.verify(authToken, process.env.ACCSESS_TOKEN_SECRET);
      //   const decodedEmail=decoded.email;
      //   if(decodedEmail===user){

      //   const query = { patient: user };
      //   const bookings = await bookingCollection.find(query).toArray();
      //   console.log("access granted and user verified")
      //   res.send(bookings);
      //   }
      //  } catch (error) {
      //     res.status(401).send({message:'unauthorized access'})

      //   }
    });

    /**
     * Available booking
     *
     *
     */
    app.get("/available", async (req, res) => {
      const date = req.query.date;

      // step 1:  get all services
      const services = await serviceCollection.find().toArray();

      // step 2: get the booking of that day. output: [{}, {}, {}, {}, {}, {}]
      const query = { date: date };
      const bookings = await bookingCollection.find(query).toArray();

      // step 3: for each service
      services.forEach((service) => {
        // step 4: find bookings for that service. output: [{}, {}, {}, {}]
        const serviceBookings = bookings.filter(
          (book) => book.treatment === service.name
        );
        // step 5: select slots for the service Bookings: ['', '', '', '']
        const bookedSlots = serviceBookings.map((book) => book.slot);
        // step 6: select those slots that are not in bookedSlots
        const available = service.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
        //step 7: set available to slots to make it easier
        service.slots = available;
      });

      res.send(services);
    });

    //new user creation
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const token = jwt.sign(
        { email: email },
        process.env.ACCSESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );
      const result = await userCollection.updateOne(filter, updateDoc, options);
      res.send({ result, token });
    });

    // if he is an admin 
    app.get('/admin/:email',async(req,res)=>{
      const email= req.params.email;
      const user = await userCollection.findOne({email:email})
      const isAdmin = user.role === 'Admin';
      res.send({admin: isAdmin})
    })

    app.put("/user/admin/:email", verifyJwt, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role) {
        const updateDoc = {
          $set: { role: "Admin" },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send({ result });
      }else{
        return res.status(403).send({message:"Forbidden access"})
      }
    });
  } finally {
  }
}
run();

app.get("/", (req, res) => {
  res.send("Doctors POrtal running");
});

app.listen(port, () => {
  console.log(`Doctors portal Is running on ${port}`);
});
