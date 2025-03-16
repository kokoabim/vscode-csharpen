namespace CSharpDotNetProject;

public class FieldsToProperties
{
    public int PropertyIntWithoutValue => 0;
    public int PropertyIntWithValue { get; set; } = 0;
    protected readonly int IntWithValue = 0;
}