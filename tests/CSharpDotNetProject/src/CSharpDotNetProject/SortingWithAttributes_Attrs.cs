namespace CSharpDotNetProject;

public class KeyAttribute : Attribute
{
}

public class DisplayAttribute : Attribute
{
}

public class MaxLengthAttribute : Attribute
{
    public MaxLengthAttribute(int length)
    {
    }
}

public class StringedAttribute : Attribute
{
    public StringedAttribute(string value)
    {
    }
}