import mysql from 'mysql';
import config from './config.js';
import fetch from 'node-fetch';
import express, { query } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import bodyParser from 'body-parser';
import response from 'express';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
const port = process.env.PORT || 9000;
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, "client/build")));

// database connection
let db = mysql.createConnection(config);
db.connect((err) => {
    if (err) {
      console.error('Error connecting to the database:', err);
      return;
    }
    console.log('Connected to the MySQL database');
});
  
function queryAsync(sql) {
    return new Promise((resolve, reject) => {
        db.query(sql, (err, result) => {
        if (err) {
            reject(err);
        } else {
            resolve(result);
        }
        });
    });
}

// LESSONS---------------------------------------------------------------------------------------

// Insert new Lesson Record
app.post('/createLesson', async (req, res) => {
	let { title, user_id, description, is_public, citation} = req.body;

    const query = 'INSERT INTO lessons (title, description, user_id, is_public, citation) VALUES (?, ?, ?, ?, ?)';
    db.query(query, [title, description, user_id, is_public, citation], (err, results) => {
        if (err) {
            console.error('Error inserting new lesson:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        res.json({success : "New Lesson created successfully", status : 200, id: results.insertId});
    });
});

// Insert new Lesson Section Record
app.post('/createLessonSection', async (req, res) => {
	let { lessonId, title, body} = req.body;

    const query = 'INSERT INTO lesson_sections (title, body, lesson_id) VALUES (?, ?, ?)';
    db.query(query, [title, body, lessonId], (err, results) => {
        if (err) {
            console.error('Error inserting new lesson section:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        res.json({success : "New Lesson Section created successfully", status : 200});
    });
});

// Insert new Lesson Practice Question
app.post('/createLessonPracticeQuestion', async (req, res) => {
	let { question, option_a, option_b, option_c, option_d, answer, lessonId } = req.body;

    const query = 'INSERT INTO lesson_practice_questions (question, option_a, option_b, option_c, option_d, answer, lesson_id) VALUES (?, ?, ?, ?, ?, ?, ?)';
    db.query(query, [question, option_a, option_b, option_c, option_d, answer, lessonId], (err, results) => {
        if (err) {
            console.error('Error inserting new lesson practice question:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        res.json({success : "New Lesson Practice Question created successfully", status : 200});
    });
});

// Endpoint to increment views for a lesson
app.post('/lessons/:lessonId/view', (req, res) => {
    const lessonId = req.body.lesson_id;
    const viewerId = req.body.viewer_id;
  
    // Increment view count for the lesson
    db.query('UPDATE lessons SET view_count = view_count + 1 WHERE id = ?', [lessonId], (error, results) => {
        if (error) {
            console.error('Error updating view count:', error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    
        // Insert view record if logged in
        if(viewerId !== ""){
            db.query('INSERT INTO views (lesson_id, viewer_id) VALUES (?, ?)', [lessonId, viewerId], (error, results) => {
                if (error) {
                console.error('Error recording view:', error);
                return res.status(500).json({ message: 'Internal server error' });
                }
                res.status(200).json({ message: 'View recorded successfully' });
            });
        }
        else{
            res.status(200).json({ message: 'View recorded successfully' });
        }
    });
});

// Get a lesson
app.post('/lesson', async (req, res) => {
    let lesson_id = req.body.lesson_id;

    const query = `SELECT * FROM lessons WHERE id=?`;

    db.query(query, [lesson_id], (err, results) => {
        if (err) {
            console.error('Error retrieving lesson:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        if (results.length > 0) {
            res.json({ lesson: results });
        } else {
            return res.status(404).json({ error: 'Lesson not found' });
        }
    });
});

// Get Lesson Sections
app.post('/lessonSections', async (req, res) => {
    let lesson_id = req.body.lesson_id;

    const query = `SELECT * FROM lesson_sections WHERE lesson_id=? ORDER BY id ASC`;

    db.query(query, [lesson_id], (err, results) => {
        if (err) {
            console.error('Error retrieving lesson sections:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        if (results.length > 0) {
            res.json({ lesson: results });
        } else {
            return res.status(404).json({ error: 'No Lesson Sections were found' });
        }
    });
});

// Get Lesson Practice Questions
app.post('/lessonPracticeQuestions', async (req, res) => {
    let lesson_id = req.body.lesson_id;

    const query = `SELECT * FROM lesson_practice_questions WHERE lesson_id=?`;

    db.query(query, [lesson_id], (err, results) => {
        if (err) {
            console.error('Error retrieving lesson practice questions:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        if (results.length > 0) {
            res.json({ lesson: results });
        } else {
            return res.status(404).json({ error: 'No Practice Questions were found for the provided lesson id' });
        }
    });
});

//search and return lessons
app.post('/searchLessons', (req, res) => {
    const { title, description, citation, name } = req.body;
  
    //data and filter by inputted fields
    const sql = `
        SELECT lessons.id, lessons.title, lessons.description, lessons.created_at, lessons.updated_at, lessons.citation, lessons.view_count, CONCAT(users.first_name, ' ', users.last_name) AS name
        FROM lessons
        INNER JOIN users ON lessons.user_id = users.id
        WHERE lessons.is_public = 1
        AND lessons.title LIKE CONCAT('%', ?, '%')
        AND lessons.description LIKE CONCAT('%', ?, '%')
        AND lessons.citation LIKE CONCAT('%', ?, '%')
        AND CONCAT(users.first_name, ' ', users.last_name) LIKE CONCAT('%', ?, '%');
    `;

    db.query(sql, [title, description, citation, name], (err, results) => {
      if (err) {
        console.error('Error fetching lessons:', err);
        res.status(500).json({ error: 'An error occurred while fetching lessons' });
        return;
      }
  
      res.json({ lessons: results });
    });
  });

// LESSON LIKES---------------------------------------------------------------------------------------------

// like actions for a lesson
app.post('/like', (req, res) => {
    const { action, user_id, lesson_id } = req.body;
  
    if (action === 'add') {
      // Add a like
      db.query('INSERT INTO likes (user_id, lesson_id) VALUES (?, ?)', [user_id, lesson_id], (error, results) => {
        if (error) {
          console.error('Error adding like:', error);
          return res.status(500).json({ message: 'Internal server error' });
        }
        res.status(200).json({ message: 'Like added successfully' });
      });
    } else if (action === 'remove') {
      // Remove a like
      db.query('DELETE FROM likes WHERE user_id = ? AND lesson_id = ?', [user_id, lesson_id], (error, results) => {
        if (error) {
          console.error('Error removing like:', error);
          return res.status(500).json({ message: 'Internal server error' });
        }
        res.status(200).json({ message: 'Like removed successfully' });
      });
    } else if (action === 'check') {
      // Check if a like exists
      db.query('SELECT * FROM likes WHERE user_id = ? AND lesson_id = ?', [user_id, lesson_id], (error, results) => {
        if (error) {
          console.error('Error checking like:', error);
          return res.status(500).json({ message: 'Internal server error' });
        }
  
        if (results.length > 0) {
          res.status(200).json({ liked: true });
        } else {
          res.status(200).json({ liked: false });
        }
      });
    } else {
      res.status(400).json({ message: 'Invalid action' });
    }
});

// Endpoint to fetch the number of likes on a lesson
app.post('/lessonlikes', (req, res) => {
    const { lesson_id } = req.body;

    db.query('SELECT COUNT(*) AS like_count FROM likes WHERE lesson_id = ?', [lesson_id], (error, results) => {
      if (error) {
        console.error('Error fetching like count:', error);
        return res.status(500).json({ message: 'Internal server error' });
      }
      res.status(200).json({ like_count: results[0].like_count });
    });
});

// ------------------------------------------------------------------------------------------------------------

// USERS LESSON DASH----------------------------------------------------------------------------

// fetch lessons created by a user
app.post('/lessons/byme', (req, res) => {
    const { user_id } = req.body;
  
    db.query(`SELECT lessons.*, CONCAT(users.first_name, ' ', users.last_name) AS name
    FROM lessons
    LEFT JOIN users ON lessons.user_id = users.id
    WHERE user_id = ?
    GROUP BY lessons.id
    ORDER BY lessons.id DESC`, [user_id], (error, results) => {
      if (error) {
        console.error('Error fetching lessons:', error);
        return res.status(500).json({ message: 'Internal server error' });
      }
      res.status(200).json(results);
    });
});

// fetch all liked lessons for a user
app.post('/lessons/liked', (req, res) => {
    const { user_id } = req.body;

    const query = `SELECT lessons.*, CONCAT(users.first_name, ' ', users.last_name) AS name
     FROM lessons 
     INNER JOIN likes ON lessons.id = likes.lesson_id 
     LEFT JOIN users ON lessons.user_id = users.id
     WHERE likes.user_id = ?
     GROUP BY lessons.id`;
    db.query(query, [user_id], (error, results) => {
        if (error) {
            console.error('Error fetching liked lessons:', error);
            return res.status(500).json({ message: 'Internal server error' });
        }
        res.status(200).json(results);
    });
});

// Lesson shared with a user
app.post('/lessons/sharedwithme', (req, res) => {
    const { email } = req.body;

    const query = `SELECT lessons.id, lessons.title, lessons.description, lessons.user_id, lessons.created_at, lessons.updated_at, lessons.is_public, lessons.citation, CONCAT(users.first_name, ' ', users.last_name) AS name, users.email AS sender_email
    FROM lessons 
    INNER JOIN shares ON lessons.id = shares.lesson_id 
    LEFT JOIN users ON lessons.user_id = users.id
    WHERE shares.recipient_email = ?
    GROUP BY lessons.id, lessons.title, lessons.description, lessons.user_id, lessons.created_at, lessons.updated_at, lessons.is_public, lessons.citation, name, sender_email;
    `;
    db.query(query, [email], (error, results) => {
        if (error) {
            console.error('Error fetching shared lessons:', error);
            return res.status(500).json({ message: 'Internal server error' });
        }
        res.status(200).json(results);
    });
});

// Fetch a users most recently viewed lessons
app.post('/lessons/recentlyviewed', (req, res) => {
    const { user_id } = req.body;

    const query = `
        SELECT 
        DISTINCT recent_views.*, 
        CONCAT(users.first_name, ' ', users.last_name) AS name
        FROM (
            SELECT 
                lessons.id, 
                lessons.title, 
                lessons.description, 
                lessons.user_id, 
                lessons.created_at, 
                lessons.updated_at, 
                lessons.is_public, 
                lessons.citation
            FROM lessons 
            INNER JOIN views ON lessons.id = views.lesson_id 
            WHERE views.viewer_id = ?
            ORDER BY views.view_timestamp DESC
            LIMIT 10
        ) AS recent_views
        LEFT JOIN users ON recent_views.user_id = users.id;
    `;
    
    db.query(query, [user_id], (error, results) => {
        if (error) {
            console.error('Error fetching recently viewed lessons:', error);
            return res.status(500).json({ message: 'Internal server error' });
        }
        res.status(200).json(results);
    });
});

// -----------------------------------------------------------------------------------

// USERS COURSE DASH----------------------------------------------------------------------------

// fetch courses created by a user
app.post('/coursedash/byme', (req, res) => {
    const { user_id } = req.body;
    let query = `SELECT courses.id, courses.course_name, courses.description, GROUP_CONCAT(course_subjects.subject_name SEPARATOR ', ') AS subjects, CONCAT(users.first_name, ' ', users.last_name) AS instructor
        FROM courses
        INNER JOIN users ON courses.user_id = users.firebase_uid
        LEFT JOIN course_subjects ON course_subjects.course_id = courses.id
        WHERE users.firebase_uid = ?
        GROUP BY courses.id, courses.course_name, courses.description, CONCAT(users.first_name, ' ', users.last_name);`

    db.query(query, [user_id], (error, results) => {
      if (error) {
        console.error('Error fetching users own courses:', error);
        return res.status(500).json({ message: 'Internal server error' });
      }
      res.status(200).json(results);
    });
});

// fetch all liked lessons for a user
app.post('/coursedash/enrolled', (req, res) => {
    const { user_id } = req.body;

    const query = `
        SELECT courses.id, courses.course_name, courses.description, GROUP_CONCAT(course_subjects.subject_name SEPARATOR ', ') AS subjects, CONCAT(users.first_name, ' ', users.last_name) AS instructor
        FROM courses
        INNER JOIN users ON courses.user_id = users.firebase_uid
        LEFT JOIN course_subjects ON course_subjects.course_id = courses.id
        LEFT JOIN course_users on course_users.course_id = courses.id
        WHERE course_users.user_id = ?
        GROUP BY courses.id, courses.course_name, courses.description, CONCAT(users.first_name, ' ', users.last_name);`;
    
    db.query(query, [user_id], (error, results) => {
        if (error) {
            console.error('Error fetching enrolled courses:', error);
            return res.status(500).json({ message: 'Internal server error' });
        }
        res.status(200).json(results);
    });
});

// ------------------------------------------------------------------------------------------------------------

// USERS--------------------------------------------------------------------------------------------------

// registration endpoint
app.post('/register', async (req, res) => {
	let newUser = req.body;

	// check if users exists
	var result = await queryAsync(`SELECT * FROM users WHERE email=\'${newUser.email}\'`);
	if(result.length == 0){
		const query = 'INSERT INTO users (first_name, last_name, email, firebase_uid) VALUES (?, ?, ?, ?)';
		db.query(query, [newUser.first_name, newUser.last_name, newUser.email, newUser.firebase_uid], (err, results) => {
			if (err) {
				console.error('Error inserting new user:', err);
				return res.status(500).json({ error: 'Internal Server Error' });
			}
			res.json({success : "Registration success", status : 200});
		});
	} else{
		res.status(400).json({ error: 'A user with that email already exists' });
	}
});

app.get('/getUserDetails', async (req, res) => {
    const firebaseId = req.query.firebase_uid;

    try {
        const query = `SELECT * FROM users WHERE firebase_uid = ?`;
        db.query(query, [firebaseId], (err, result) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Internal Server Error' });
            }
            if (result.length > 0) {
                const userDetails = result[0];
                res.json(userDetails);
            } else {
                res.status(404).json({ error: 'User not found' });
            }
        });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/getDBUserDetails', async (req, res) => {
    const userId = req.query.id;

    try {
        const query = `SELECT * FROM users WHERE id = ?`;
        db.query(query, [userId], (err, result) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Internal Server Error' });
            }
            if (result.length > 0) {
                const userDetails = result[0];
                res.json(userDetails);
            } else {
                res.status(404).json({ error: 'User not found' });
            }
        });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Endpoint to update user profile picture
app.post('/updateUserProfilePic', async (req, res) => {
    const { firebase_uid, profile_pic_url } = req.body;
    console.log(firebase_uid, profile_pic_url)
    
    const query = 'UPDATE users SET profile_pic_url = ? WHERE firebase_uid = ?';
    db.query(query, [profile_pic_url, firebase_uid], (err, results) => {
        if (err) {
            console.error('Error updating profile picture:', err);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }
        res.json({ success: "Profile picture updated successfully", status: 200 });
    });
});


// ----------------------------------------------------------------------------------------------------------


// COURSES--------------------------------------------------------------------------------------------------

//create course, put in tables
app.post('/createCourse', async (req, res) => {
    try {

        const { courseName, description, subjects, isPublic, maxUsers, user_id } = req.body;

        // Insert data into the courses table
        const courseQuery = 'INSERT INTO courses (course_name, description, is_public, max_users, user_id) VALUES (?, ?, ?, ?, ?)';
        db.query(courseQuery, [courseName, description, isPublic, maxUsers, user_id], (courseError, courseResult) => {
            if (courseError) {
                console.error('Error inserting course:', courseError.message);
                res.status(500).json({ error: 'Internal Server Error' });
                return;
            }

            //get courseid
            const course_id = courseResult.insertId;

            // inserts corresponding subjects and course_id
            const subjectsArray = subjects.split(',').map((subject) => [course_id, subject.trim()]);
            const subjectsQuery = 'INSERT INTO course_subjects (course_id, subject_name) VALUES ?';
            db.query(subjectsQuery, [subjectsArray], (subjectsError) => {
                if (subjectsError) {
                    console.error('Error inserting subjects:', subjectsError.message);
                    res.status(500).json({ error: 'Internal Server Error' });
                    return;
                }

                // return status and course_id
                res.status(200).json({ success: true, course_id });
            });
        });
    } catch (error) {
        console.error('Error creating course:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

//grab course info 
app.post('/courseInfo', async (req, res) => {
    let course_id = req.body.course_id;

    const query = `
        SELECT courses.id, courses.course_name, courses.description, courses.is_public, courses.max_users, courses.user_id, users.first_name, users.last_name, users.email, users.firebase_uid
        FROM courses
        JOIN users ON courses.user_id = users.firebase_uid
        WHERE courses.id = ?;
    `;

    db.query(query, [course_id], (err, results) => {
        if (err) {
            console.error('Error retrieving course info:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        // check if any rows were returned
        if (results.length > 0) {

            // send the result back to the client
            res.json({ courseInfo: results[0] });
        } else {

            // no matching course found
            return res.status(404).json({ error: 'Course not found' });
        }
    });
});

app.post('/courseFetchLessons', async (req, res) => {
    let course_id = req.body.course_id;

    const query = `
        SELECT lessons.id, lessons.title, lessons.description, lessons.created_at, lessons.updated_at, lessons.citation, lessons.view_count, CONCAT(users.first_name, ' ', users.last_name) AS name, course_lessons.date_added
        FROM lessons
        INNER JOIN users ON lessons.user_id = users.id
        INNER JOIN course_lessons ON lessons.id = course_lessons.lesson_id
        WHERE course_lessons.course_id = ?
        ORDER BY course_lessons.date_added DESC;
    `;

    db.query(query, [course_id], (err, results) => {
      if (err) {
        console.error('Error fetching course lessons:', err);
        res.status(500).json({ error: 'An error occurred while fetching course lessons' });
        return;
      }
  
      res.json({ courses: results });
    });
});

app.post('/addNewCourseLesson', async (req, res) => {
    let course_id = req.body.course_id;
    let lesson_id = req.body.lesson_id;
    let current_id = req.body.current_id;

    const query1 = `
        SELECT * 
        FROM courses
        LEFT JOIN course_administrators ON courses.id = course_administrators.course_id
        WHERE (courses.user_id = ? OR course_administrators.admin_id = ?) AND courses.id = ?
    `;

    db.query(query1, [current_id, current_id, course_id], (err, results) => {
        if (err) {
        console.error('Error while checking course permissions:', err);
        res.status(500).json({ error: 'Error while checking course permissions.' });
        return;
        }

        if (results.length === 0) {
        res.status(403).json({ error: 'Current user is not the owner or an administrator of the course.' });
        return;
        }

        const query2 = `
        INSERT INTO course_lessons (course_id, lesson_id) VALUES (?, ?)
        `;
        
        db.query(query2, [course_id, lesson_id], (err, insertResult) => {
            if (err) {
                console.error('Error while adding new lesson:', err);
                res.status(500).json({ error: 'Error while adding new lesson.' });
                return;
            }

            res.status(200).json({success: true});
        });
    });
});

app.post('/deleteCourseLesson', async (req, res) => {
    let course_id = req.body.course_id;
    let lesson_id = req.body.lesson_id;
    let current_id = req.body.current_id;

    const query1 = `
        SELECT * 
        FROM courses
        LEFT JOIN course_administrators ON courses.id = course_administrators.course_id
        WHERE (courses.user_id = ? OR course_administrators.admin_id = ?) AND courses.id = ?
    `;

    db.query(query1, [current_id, current_id, course_id], (err, results) => {
        if (err) {
            console.error('Error while checking course permissions:', err);
            res.status(500).json({ error: 'Error while checking course permissions.' });
            return;
        }

        if (results.length === 0) {
            res.status(403).json({ error: 'Current user is not the owner or an administrator of the course.' });
            return;
        }

        const query2 = `
            DELETE FROM course_lessons
            WHERE course_id = ? AND lesson_id = ?
        `;

        db.query(query2, [course_id, lesson_id], (err, deleteResult) => {
            if (err) {
                console.error('Error while deleting lesson:', err);
                res.status(500).json({ error: 'Error while deleting lesson.' });
                return;
            }

            if (deleteResult.affectedRows === 0) {
                res.status(404).json({ error: 'Lesson not found for deletion.' });
                return;
            }

            res.status(200).json({ success: true });
        });
    });
});


app.post('/courseFetchClasslist', async (req, res) => {
    let course_id = req.body.course_id;

    const query = `
        SELECT course_users.user_id, CONCAT(users.first_name, ' ', users.last_name) AS name, users.email
        FROM course_users
        INNER JOIN users ON course_users.user_id = users.firebase_uid
        WHERE course_id = ?
        ORDER BY name DESC;
    `;

    db.query(query, [course_id], (err, results) => {
      if (err) {
        console.error('Error fetching course lessons:', err);
        res.status(500).json({ error: 'An error occurred while fetching course lessons' });
        return;
      }
  
      res.json({ classlist: results });
    });
});

app.post('/joinClasslist', async (req, res) => {
    let course_id = req.body.course_id;
    let current_id = req.body.current_id;

    // check if the current_id matches the firebase_uid of the course owner
    const query1 = `
        SELECT user_id
        FROM courses
        WHERE id = ?;
    `;

    const query2 = `
        INSERT INTO course_users (course_id, user_id) VALUES (?, ?)
    `;


    db.query(query1, [course_id], (err, results) => {
        if (err) {
            console.error('error checking course owner:', err);
            return res.status(500).json({ error: 'internal server error' });
        }

        if (results.length === 0) {
            console.error('course not found');
            return res.status(404).json({ error: 'course not found' });
        }

        const courseOwnerUid = results[0].user_id;

        if (current_id === courseOwnerUid) {
            console.error('joining user cannot be course owner');
            return res.status(403).json({ error: 'forbidden:  user cannot be course owner' });
        }

        db.query(query2, [course_id, current_id], (err, results) => {
            if (err) {
                console.error('error adding course user:', err);
                return res.status(500).json({ error: 'internal server error' });
            }

            return res.status(200).json({ success: true });
        });


    
    });
});

app.post('/leaveClasslist', async (req, res) => {
    let course_id = req.body.course_id;
    let current_id = req.body.current_id;

    const query = `
        DELETE FROM course_users 
        WHERE course_id = ? AND user_id = ?;
    `;

    db.query(query, [course_id, current_id], (err, results) => {
        if (err) {
            console.error('error removing course user:', err);
            return res.status(500).json({ error: 'internal server error' });
        }

        return res.status(200).json({ success: true });
    });
});

app.post('/removeFromClasslist', async (req, res) => {
    let course_id = req.body.course_id;
    let current_id = req.body.current_id;
    let user_id = req.body.user_id;

    const query1 = `
        SELECT * 
        FROM courses
        LEFT JOIN course_administrators ON courses.id = course_administrators.course_id
        WHERE (courses.user_id = ? OR course_administrators.admin_id = ?) AND courses.id = ?
    `;

    db.query(query1, [current_id, current_id, course_id], (err, results) => {
        if (err) {
            console.error('Error while checking course permissions:', err);
            res.status(500).json({ error: 'Error while checking course permissions.' });
            return;
        }

        if (results.length === 0) {
            res.status(403).json({ error: 'Current user is not the owner or an administrator of the course.' });
            return;
        }

        const query2 = `
            DELETE FROM course_users 
            WHERE course_id = ? AND user_id = ?;
        `;

        db.query(query2, [course_id, user_id], (err, results) => {
            if (err) {
                console.error('error removing course user:', err);
                return res.status(500).json({ error: 'internal server error' });
            }

            return res.status(200).json({ success: true });
        });
    });
});

app.post('/courseFetchMessage', async (req, res) => {
    let course_id = req.body.course_id;

    const query = `
        SELECT course_messages.message_id, course_messages.user_id, course_messages.timestamp, course_messages.message_content, CONCAT(users.first_name, ' ', users.last_name) AS name
        FROM course_messages
        JOIN users on users.firebase_uid = course_messages.user_id
        WHERE course_messages.course_id = ?
        ORDER BY course_messages.timestamp DESC;
    `;

    db.query(query, [course_id], (err, results) => {
      if (err) {
        console.error('Error fetching course lessons:', err);
        res.status(500).json({ error: 'An error occurred while fetching course lessons' });
        return;
      }
  
      res.json({ messages: results });
    });
});

app.post('/courseAddMessage', async (req, res) => {
    let course_id = req.body.course_id;
    let user_id = req.body.user_id;
    let message_content = req.body.message_content;

    if (message_content == ''){
        console.error('No message content');
        res.status(400).json({ error: 'No message content.' });
        return;
    }
    const query1 = `
        SELECT * FROM course_users
        WHERE course_id = ? AND user_id = ?
    `

    db.query(query1, [course_id, user_id, message_content], (err, results) => {
        if (err) {
            console.error('Error fetching course lessons:', err);
            res.status(500).json({ error: 'An error occurred while fetching course lessons' });
            return;
        } 

        if (results.length <= 0){
            console.error('User not in course');
            res.status(401).json({ error: 'User not in course.' });
            return;
        }

        const query2 = 'INSERT INTO course_messages (course_id, user_id, message_content) VALUES (?, ?, ?);';


        db.query(query2, [course_id, user_id, message_content], (err, results) => {
            if (err) {
                console.error('Error fetching course lessons:', err);
                res.status(500).json({ error: 'An error occurred while fetching course lessons' });
                return;
            }
        
            res.json({ success: true });
        });
    });    
});

app.post('/courseFetchAdmin', async (req, res) => {
    let course_id = req.body.course_id;

    const query = `
        SELECT course_administrators.admin_id, users.first_name, users.last_name, users.email
        FROM course_administrators
        JOIN users on users.firebase_uid = course_administrators.admin_id
        WHERE course_id = ?;        
    `;

    db.query(query, [course_id], (err, results) => {
        if (err) {
            console.error('Error retrieving course admins:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        // check if any rows were returned
        if (results.length > 0) {

            // send the result back to the client
            res.json({ courseAdmins: results });

        } else {

            // no admins for course found
            return res.status(404).json({ error: 'No admins' });
        }
    });
});

// delete course admin
app.post('/courseDeleteAdmin', async (req, res) => {
    let course_id = req.body.course_id;
    let admin_id = req.body.admin_id;
    let current_id = req.body.current_id;

    // check if the current_id matches the firebase_uid of the course owner
    const query1 = `
        SELECT user_id
        FROM courses
        WHERE id = ?;
    `;

    db.query(query1, [course_id], (err, results) => {
        if (err) {
            console.error('error checking course owner:', err);
            return res.status(500).json({ error: 'internal server error' });
        }

        if (results.length === 0) {
            console.error('course not found');
            return res.status(404).json({ error: 'course not found' });
        }

        const courseOwnerUid = results[0].user_id;

        if (current_id !== courseOwnerUid) {
            console.error('not course owner');
            return res.status(403).json({ error: 'forbidden: not the course owner' });
        }

        // if the current_id matches the course owner's firebase_uid, proceed with deleting the admin
        const deleteAdminQuery = `
            DELETE FROM course_administrators 
            WHERE course_id = ? AND admin_id = ?;   
        `;

        db.query(deleteAdminQuery, [course_id, admin_id], (err, results) => {
            if (err) {
                console.error('error deleting course admin:', err);
                return res.status(500).json({ error: 'internal server error' });
            }

            return res.status(200).json({ success: true });
        });
    });
});


// add course admin
app.post('/courseAddAdmin', async (req, res) => {
    let course_id = req.body.course_id;
    let newAdminEmail = req.body.newAdminEmail;
    let current_id = req.body.current_id;

    // check if the current_id matches the firebase_uid of the course owner
    const query1 = `
        SELECT user_id
        FROM courses
        WHERE id = ?;
    `;

    db.query(query1, [course_id], (err, results) => {
        if (err) {
            console.error('error checking course owner:', err);
            return res.status(500).json({ error: 'internal server error' });
        }

        if (results.length === 0) {
            console.error('course not found');
            return res.status(404).json({ error: 'course not found' });
        }

        const courseOwnerUid = results[0].user_id;

        if (current_id !== courseOwnerUid) {
            console.error('not course owner');
            return res.status(403).json({ error: 'forbidden: not the course owner' });
        }

        // proceed with adding the new admin
        // fetch the firebase_uid for the provided newAdminEmail
        const query2 = 'SELECT firebase_uid FROM users WHERE email = ?;';
        db.query(query2, [newAdminEmail], async (err, results) => {
            if (err) {
                console.error('Error fetching user ID:', err);
                return res.status(500).json({ error: 'Internal Server Error' });
            }

            if (results.length === 0) {
                // user with the provided email not found
                return res.status(404).json({ error: 'User not found' });
            }

            const admin_id = results[0].firebase_uid;

            // check if the admin already exists
            const query3 = 'SELECT * FROM course_administrators WHERE course_id = ? AND admin_id = ?;';
            db.query(query3, [course_id, admin_id], async (err, results) => {
                if (err) {
                    console.error('Error checking existing association:', err);
                    return res.status(500).json({ error: 'Internal Server Error' });
                }

                if (results.length > 0) {
                    // admin already exists
                    return res.status(400).json({ error: 'Administrator already added to the course' });
                }

                // insert the new admin
                const query4 = 'INSERT INTO course_administrators (course_id, admin_id) VALUES (?, ?);';
                db.query(query4, [course_id, admin_id], (err, results) => {
                    if (err) {
                        console.error('Error adding administrator to course:', err);
                        return res.status(500).json({ error: 'Internal Server Error' });
                    }

                    return res.status(200).json({ success: true });
                });
            });
        });
    });
});

//search and return courses
app.post('/searchCourses', (req, res) => {
    const { course, description, subject, instructor } = req.body;
  
    // grab data and filter by inputted fields
    const sql = `
    SELECT courses.id, courses.course_name, courses.description, GROUP_CONCAT(course_subjects.subject_name SEPARATOR ', ') AS subjects, CONCAT(users.first_name, ' ', users.last_name) AS instructor
    FROM courses
    INNER JOIN users ON courses.user_id = users.firebase_uid
    LEFT JOIN course_subjects ON course_subjects.course_id = courses.id
    WHERE courses.is_public = 1
    AND courses.course_name LIKE CONCAT('%', ?, '%')
    AND courses.description LIKE CONCAT('%', ?, '%')
    AND CONCAT(users.first_name, ' ', users.last_name) LIKE CONCAT('%', ?, '%')
    GROUP BY courses.id, courses.course_name, courses.description, CONCAT(users.first_name, ' ', users.last_name)
    HAVING GROUP_CONCAT(course_subjects.subject_name) LIKE CONCAT('%', ?, '%');
    `;

    db.query(sql, [course, description, instructor, subject], (err, results) => {
      if (err) {
        console.error('Error fetching courses:', err);
        res.status(500).json({ error: 'An error occurred while fetching courses' });
        return;
      }
  
      res.json({ courses: results });
    });
  });


// ---------------------------------------------------------------------------------------------------------------------

// EXPLORE QUERIES----------------------------------------------------------

// Most liked lessons
app.post('/most-liked-lessons', (req, res) => {
    const sql = `
      SELECT lessons.*, COUNT(likes.lesson_id) AS like_count, CONCAT(users.first_name, ' ', users.last_name) AS author
      FROM lessons
      LEFT JOIN likes ON lessons.id = likes.lesson_id
      LEFT JOIN users ON lessons.user_id = users.id
      GROUP BY lessons.id
      ORDER BY like_count DESC
      LIMIT 6
    `;
  
    db.query(sql, (err, results) => {
      if (err) {
        console.error('Error fetching most liked lessons: ' + err);
        res.status(500).json({ error: 'Internal server error' });
        return;
      }
  
      res.json(results);
    });
});

// Most viewed lessons
app.post('/most-viewed-lessons', (req, res) => {
    const sql = `
        SELECT lessons.*, COUNT(likes.lesson_id) AS like_count, CONCAT(users.first_name, ' ', users.last_name) AS author
        FROM lessons
        LEFT JOIN likes ON lessons.id = likes.lesson_id
        LEFT JOIN users ON lessons.user_id = users.id
        GROUP BY lessons.id
        ORDER BY view_count DESC
        LIMIT 6
    `;
  
    db.query(sql, (err, results) => {
      if (err) {
        console.error('Error fetching most viewed lessons: ' + err);
        res.status(500).json({ error: 'Internal server error' });
        return;
      }
  
      res.json(results);
    });
});

// ----------------------------------------------------------------------

// LESSON EDITING-----------------------------------------------------

// Update lesson details
app.put('/lessons/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, is_public } = req.body;
  
      // Update lesson in the database
      const query = `UPDATE lessons SET title = ?, description = ?, is_public = ? WHERE id = ?`;
      db.query(query, [title, description, is_public, id], (err, result) => {
        return res.status(200).json({ message: 'Lesson updated successfully' });
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
    }
});

// Update lesson section
app.put('/lesson-sections/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { title, body } = req.body;
  
      // Update lesson section in the database
      const query = `UPDATE lesson_sections SET title = ?, body = ? WHERE id = ?`;
      db.query(query, [title, body, id], (err, result) => {
        res.status(200).send({ message: 'Lesson section updated successfully' });
      });
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: 'Internal server error' });
    }
});

// Update lesson practice question
app.put('/lesson-practice-questions/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { question, option_a, option_b, option_c, option_d, answer } = req.body;
  
      // Update lesson practice question in the database
      const query = `UPDATE lesson_practice_questions SET question = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, answer = ? WHERE id = ?`;
      db.query(query, [question, option_a, option_b, option_c, option_d, answer, id], (err, result) => {
        res.status(200).send({ message: 'Lesson practice question updated successfully' });
      });
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: 'Internal server error' });
    }
});

// -------------------------------------------------------------------------

// LESSON SHARE----------------------------------------------------------

app.post('/share', (req, res) => {
    try {
        const { lesson_id, sender_id, recipient_email } = req.body;

        // Check if the share already exists
        db.query('SELECT * FROM shares WHERE lesson_id = ? AND sender_id = ? AND recipient_email = ?', [lesson_id, sender_id, recipient_email], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Internal server error' });
            }

            if (result.length > 0) {
                return res.status(400).json({ error: 'Share already exists' });
            }

            // Insert the share record into the database
            db.query('INSERT INTO shares (lesson_id, sender_id, recipient_email) VALUES (?, ?, ?)', [lesson_id, sender_id, recipient_email], (err, result) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ error: 'Internal server error' });
                }

                res.status(200).json({ message: 'Lesson shared successfully' });
            });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ---------------------------------------------------------------------

app.listen(port, () => console.log(`Listening on port ${port}`)); //for the dev version
