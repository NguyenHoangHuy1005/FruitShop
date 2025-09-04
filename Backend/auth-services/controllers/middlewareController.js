const jwt = require('jsonwebtoken');

const readBearer = (req) => {
    const raw = req.headers?.authorization || req.headers?.Authorization || req.headers?.token || "";
    if (typeof raw !== "string") return "";
    const t = raw.trim();
    return t.toLowerCase().startsWith("bearer ") ? t.slice(7).trim() : t;
};

const middlewareController = {
    //verifytoken
    verifyToken: (req, res, next) => {
        const accessToken = readBearer(req);
        if (!accessToken) return res.status(401).json({ message: "you are not authenticated" });
        
        jwt.verify(accessToken, process.env.JWT_ACCESS_KEY, (err, user) => {
            if (err) return res.status(403).json({ message: "token is not valid" });
            req.user = user;
            next();
        });
    },

    verifyTokenAndAdminAuth: (req,res,next) => {
        middlewareController.verifyToken(req,res, ()=>{
            if(req.user.id == req.params.id || req.user.admin){
                next();
            }else{
                return res.status(403).json({message:"You are not allowed to delete others"});
            }
        });
    },
}

module.exports = middlewareController;